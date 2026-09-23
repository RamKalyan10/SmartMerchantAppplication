#!/usr/bin/env node
/**
 * Backfill the supply-side stock ledger from the store's sales history.
 *
 * Run from `backend/`:
 *   node src/scripts/backfillStockLedger.js --dry-run   # report only, writes nothing
 *   node src/scripts/backfillStockLedger.js             # write the ledger
 *   node src/scripts/backfillStockLedger.js --check     # verify stored state reproduces
 *   node src/scripts/backfillStockLedger.js --force     # re-run, replacing generated rows
 *
 * Why this exists rather than `reseed.js`: `seedDatabase(true)` regenerates every
 * invoice with fresh randomness, which would discard the exact sales series the
 * MASE backtest in HANDOFF.md §4 is defined against and invalidate any trained
 * artifact that fingerprints it. This is additive — invoices, products' identity,
 * expenses and users are left alone.
 *
 * What it writes:
 *   - inventory_transactions: one OPENING row per product, plus one RESTOCK row
 *     per delivery. Sales are deliberately NOT duplicated here; they already live
 *     in invoices[].items[], which is the single record of them.
 *   - purchase_orders: the orders those deliveries arrived against, which is what
 *     makes `lead_time_days` a measurable quantity instead of a declaration.
 *   - products.stock_quantity: replaced with each product's ending balance, so
 *     present stock becomes a consequence of the ledger.
 *
 * Pre-existing rows in either collection are retained untouched. Rows from an
 * earlier database lifetime are real history and this script is not entitled to
 * delete them.
 */

const db = require('../config/db');
const {
  simulateStockHistory,
  reconcileLedger,
  deriveOpeningBalances,
  LEDGER_AUTHOR
} = require('../seeds/stockHistory');

const STORE_ID = process.env.STORE_ID || 'store_dwdm_001';
const RULE = '-'.repeat(72);

const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);

const DRY_RUN = has('dry-run') || has('-n');
const CHECK = has('check') || has('-c');
const FORCE = has('force') || has('-f');

const num = (n) => Number(n || 0).toLocaleString('en-IN');

function collectStoreData() {
  return {
    products: db.table('products').find((p) => p.store_id === STORE_ID),
    invoices: db.table('invoices').find((i) => i.store_id === STORE_ID),
    suppliers: db.table('suppliers').find((s) => s.store_id === STORE_ID)
  };
}

function reportNotes(notes) {
  if (!notes || notes.length === 0) return;
  console.log('\nNotes:');
  notes.forEach((n) => console.log(`  ${n}`));
}

/** Print the shape of what would be written, before writing any of it. */
function printPlan({ transactions, purchaseOrders, products, finalStock, notes }) {
  const byType = transactions.reduce((acc, t) => {
    acc[t.type] = (acc[t.type] || 0) + 1;
    return acc;
  }, {});

  const unitsRestocked = transactions
    .filter((t) => t.type === 'RESTOCK')
    .reduce((sum, t) => sum + t.quantity, 0);

  const openingUnits = transactions
    .filter((t) => t.type === 'OPENING')
    .reduce((sum, t) => sum + t.quantity, 0);

  const received = purchaseOrders.filter((p) => p.status === 'RECEIVED').length;

  // Products end at zero if demand outran their reorder cycle; worth knowing how
  // many, because a large number means the rule under-orders rather than that the
  // store is genuinely out of everything.
  let endedAtZero = 0;
  let changed = 0;
  let unchanged = 0;
  for (const product of products) {
    const final = finalStock.get(product.id);
    if (final === undefined) continue;
    if (final === 0) endedAtZero += 1;
    if (final !== Number(product.stock_quantity)) changed += 1;
    else unchanged += 1;
  }

  const poValue = purchaseOrders.reduce(
    (sum, p) => sum + p.quantity * (Number(p.unit_cost) || 0),
    0
  );

  console.log(`\nLedger to generate for ${STORE_ID}:`);
  console.log(`  inventory_transactions  ${num(transactions.length)}`);
  Object.entries(byType)
    .sort()
    .forEach(([type, count]) => console.log(`      ${type.padEnd(9)} ${num(count)}`));
  console.log(`  purchase_orders         ${num(purchaseOrders.length)}` +
    `  (${num(received)} received, ${num(purchaseOrders.length - received)} still in flight)`);
  console.log(`  goods received within window value approx ₹${num(Math.round(poValue))}`);
  console.log(`  opening units           ${num(openingUnits)}`);
  console.log(`  restocked units         ${num(unitsRestocked)}`);
  console.log(`  products ending at 0    ${num(endedAtZero)}`);
  console.log(`  stock quantity changed  ${num(changed)} of ${num(products.length)}` +
    `  (${num(unchanged)} unchanged)`);
}

/** Per-product before/after table, capped so a 46-row catalog stays readable. */
function printStockTable({ products, finalStock, openingBalances, sources }, limit = 50) {
  console.log('\n  product                              opening   final   delta  opening source');
  console.log(`  ${'-'.repeat(84)}`);
  const rows = products
    .map((p) => ({
      name: (p.name || p.id).slice(0, 34).padEnd(34),
      opening: openingBalances.get(p.id) ?? 0,
      final: finalStock.get(p.id),
      source: sources.get(p.id) || ''
    }))
    .filter((r) => r.final !== undefined)
    // Most-depleted first: a product that ended far below where it started is the
    // one worth looking at, and it is the signal that the rule under-ordered.
    .sort((a, b) => (a.final - a.opening) - (b.final - b.opening));

  rows.slice(0, limit).forEach((r) => {
    const delta = r.final - r.opening;
    const deltaStr = (delta >= 0 ? '+' : '') + delta;
    console.log(
      `  ${r.name} ${String(r.opening).padStart(7)} ${String(r.final).padStart(7)} ` +
        `${deltaStr.padStart(8)}  ${r.source}`
    );
  });
  if (rows.length > limit) console.log(`  ... and ${rows.length - limit} more`);
}

function runCheck() {
  const { products, invoices, suppliers } = collectStoreData();
  const transactions = db.table('inventory_transactions').find((t) => t.store_id === STORE_ID);
  const purchaseOrders = db.table('purchase_orders').find((p) => p.store_id === STORE_ID);

  console.log(`\nChecking stock state for ${STORE_ID}\n${RULE}`);

  const generated = transactions.filter((t) => t.created_by === LEDGER_AUTHOR).length;
  if (generated === 0) {
    console.log(
      'No generated ledger rows found. Run the backfill before --check.\n' +
        '(--check verifies a ledger that exists; it does not create one.)'
    );
    process.exitCode = 1;
    return;
  }

  const result = reconcileLedger({
    products,
    invoices,
    suppliers,
    transactions,
    purchaseOrders,
    storeId: STORE_ID
  });

  const covered = result.products.filter((p) => p.covered);
  const unbalanced = covered.filter((p) => !p.balanced);
  const uncovered = result.products.filter((p) => !p.covered);
  const negative = result.products.filter((p) => p.negative);
  const rowDrift = covered.filter(
    (p) => p.missing_rows > 0 || p.extra_rows > 0 || p.quantity_mismatches > 0
  );
  const leadTimeBad = covered.filter((p) => !p.lead_time_ok);
  const preExisting = result.products.reduce((sum, p) => sum + p.pre_existing_rows, 0);

  console.log(`  products in ledger      ${num(covered.length)}`);
  console.log(`  reproducible            ${num(covered.length - unbalanced.length)}`);
  console.log(`  NOT reproducible        ${num(unbalanced.length)}`);
  console.log(`  ledger row drift        ${num(rowDrift.length)}`);
  console.log(`  negative balances       ${num(negative.length)}`);
  console.log(`  lead time mismatches    ${num(leadTimeBad.length)}`);
  if (preExisting > 0) {
    console.log(
      `  pre-existing rows       ${num(preExisting)} (retained, not counted as drift)`
    );
  }
  if (uncovered.length > 0) {
    console.log(`  products without a ledger row: ${num(uncovered.length)}`);
    uncovered.slice(0, 10).forEach((p) => console.log(`      ${p.product_name}`));
  }

  if (unbalanced.length > 0) {
    console.log('\n  Products whose stored stock does not match a replay of the rule:');
    console.log('    product                              stored   replay   opening  restocked');
    unbalanced.slice(0, 30).forEach((p) => {
      console.log(
        `    ${(p.product_name || p.product_id).slice(0, 34).padEnd(34)} ` +
          `${String(p.stored_stock).padStart(6)} ${String(p.simulated_final).padStart(8)} ` +
          `${String(p.opening ?? '-').padStart(8)} ${String(p.restocked).padStart(10)}`
      );
    });
  }

  if (rowDrift.length > 0) {
    console.log('\n  Ledger rows that differ from a replay:');
    rowDrift.slice(0, 30).forEach((p) => {
      console.log(
        `    ${(p.product_name || p.product_id).slice(0, 34).padEnd(34)} ` +
          `stored=${p.stored_rows} expected=${p.expected_rows} ` +
          `missing=${p.missing_rows} extra=${p.extra_rows} ` +
          `qty_mismatch=${p.quantity_mismatches}`
      );
    });
  }

  if (leadTimeBad.length > 0) {
    console.log('\n  Purchase orders whose arrival did not match the declared lead time:');
    leadTimeBad.slice(0, 20).forEach((p) => {
      p.lead_time_checks
        .filter((c) => !c.ok)
        .slice(0, 3)
        .forEach((c) => {
          console.log(
            `    ${c.id}  actual=${c.actual}d declared=${c.declared}d (${p.product_name})`
          );
        });
    });
  }

  reportNotes(result.notes);

  const ok =
    unbalanced.length === 0 &&
    rowDrift.length === 0 &&
    negative.length === 0 &&
    leadTimeBad.length === 0;

  console.log(`\n${RULE}`);
  console.log(
    ok
      ? 'PASS  Stock is reproducible from the sales history and the generated ledger.'
      : 'FAIL  See the discrepancies above.'
  );

  // What a failure here does and does not mean. Immediately after a backfill the
  // check must pass outright. Once the app records new movements it can drift for
  // legitimate reasons, and saying so is more useful than a bare FAIL.
  if (!ok) {
    console.log(
      '\nNote: this replay compares stored state against what the seed rule would\n' +
        'produce. Sales recorded through the app since the backfill are replayed too,\n' +
        'so those stay in step — but a live database can legitimately drift if the\n' +
        'reorder rule would now raise an order the stored ledger does not contain.\n' +
        'Run with --force to regenerate the ledger from the current history.'
    );
  }
  if (!ok) process.exitCode = 1;
}

function main() {
  if (CHECK) return runCheck();

  const { products, invoices, suppliers } = collectStoreData();

  if (products.length === 0) {
    console.error(`No products found for ${STORE_ID}. Nothing to do.`);
    process.exitCode = 1;
    return;
  }

  const allTx = db.table('inventory_transactions').find((t) => t.store_id === STORE_ID);
  const generatedTx = allTx.filter((t) => t.created_by === LEDGER_AUTHOR);
  const preExistingTx = allTx.length - generatedTx.length;

  // Rows written before `store_id` was added to this collection are invisible to
  // every store-scoped filter, so they need counting explicitly to be visible at
  // all. They are left alone: they belong to an earlier database lifetime, and
  // deleting them would be destroying history this script did not create.
  const orphanedTx = db.data.inventory_transactions.filter((t) => !t.store_id).length;

  if (generatedTx.length > 0 && !FORCE) {
    console.error(
      `\n${num(generatedTx.length)} generated ledger rows already exist for ${STORE_ID}.\n` +
        'Running again would append a second copy of the same history.\n\n' +
        '  Verify what is there:   node src/scripts/backfillStockLedger.js --check\n' +
        '  Replace it:             node src/scripts/backfillStockLedger.js --force\n'
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nStock ledger backfill — ${STORE_ID}`);
  console.log(RULE);
  console.log(`  invoices        ${num(invoices.length)}`);
  console.log(`  products        ${num(products.length)}`);
  console.log(`  suppliers       ${num(suppliers.length)}`);
  console.log(`  existing ledger ${num(allTx.length)} rows` +
    (preExistingTx > 0 ? ` (${num(preExistingTx)} pre-existing, will be retained)` : ''));
  if (orphanedTx > 0) {
    console.log(
      `  ${num(orphanedTx)} further rows carry no store_id and are invisible to the app ` +
        'and to this backfill; left untouched.'
    );
  }

  // Present stock is not a safe opening balance for a product the app has already
  // sold: it was decremented at the time, and the replay decrements it again from
  // the same invoice.
  const { balances: openingBalances, sources } = deriveOpeningBalances({
    products,
    transactions: allTx,
    storeId: STORE_ID
  });

  const fromLedger = [...sources.values()].filter((s) => s.startsWith('ledger')).length;
  if (fromLedger > 0) {
    console.log(
      `  ${num(fromLedger)} products had prior movements; their opening balance was read ` +
        'from the earliest recorded previous_stock rather than current stock.'
    );
  }

  const simulation = simulateStockHistory({
    products,
    invoices,
    suppliers,
    storeId: STORE_ID,
    openingBalances
  });

  if (simulation.transactions.length === 0) {
    console.error('\nThe simulator produced no rows. Nothing was written.');
    reportNotes(simulation.notes);
    process.exitCode = 1;
    return;
  }

  printPlan({ ...simulation, products });
  printStockTable({ products, finalStock: simulation.finalStock, openingBalances, sources });
  reportNotes(simulation.notes);

  if (DRY_RUN) {
    console.log(`\n${RULE}`);
    console.log('Dry run — nothing was written. Re-run without --dry-run to apply.');
    return;
  }

  // Chronological on disk so the file reads as a ledger and the audit log
  // (which sorts by created_at) does not need to reorder it.
  const transactions = simulation.transactions
    .slice()
    .sort((a, b) =>
      String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(b.id)
    );
  const purchaseOrders = simulation.purchaseOrders
    .slice()
    .sort((a, b) =>
      String(a.ordered_at).localeCompare(String(b.ordered_at)) || String(a.id).localeCompare(b.id)
    );

  console.log(`\n${RULE}`);
  if (FORCE && generatedTx.length > 0) {
    db.data.inventory_transactions = db.data.inventory_transactions.filter(
      (t) => !(t.store_id === STORE_ID && t.created_by === LEDGER_AUTHOR)
    );
    db.data.purchase_orders = (db.data.purchase_orders || []).filter(
      (p) => !(p.store_id === STORE_ID && p.created_by === LEDGER_AUTHOR)
    );
    console.log(`  --force: removed ${num(generatedTx.length)} previously generated rows`);
  }

  db.data.inventory_transactions = db.data.inventory_transactions || [];
  db.data.purchase_orders = db.data.purchase_orders || [];

  // autoSave=false throughout so the 6.7MB file is rewritten once, not per row.
  // The records keep their own ids (`itx_…`, `PO-…`) and explicit created_at —
  // insertMany spreads the record last, so both survive the defaults.
  db.table('inventory_transactions').insertMany(transactions);
  db.table('purchase_orders').insertMany(purchaseOrders);

  let stockUpdated = 0;
  for (const product of products) {
    const final = simulation.finalStock.get(product.id);
    if (final === undefined || final === Number(product.stock_quantity)) continue;
    db.table('products').update(product.id, { stock_quantity: final }, false);
    stockUpdated += 1;
  }

  db.save();

  console.log(`  wrote ${num(transactions.length)} inventory_transactions`);
  console.log(`  wrote ${num(purchaseOrders.length)} purchase_orders`);
  console.log(`  updated stock_quantity on ${num(stockUpdated)} products`);
  console.log(`${RULE}`);
  console.log('Done. Verify with:  node src/scripts/backfillStockLedger.js --check');
}

main();
