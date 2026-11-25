/**
 * Demand-driven stock history generator.
 *
 * The store database used to hold a `stock_quantity` literal per product that
 * had no relationship to the seeded invoices, and an `inventory_transactions`
 * collection that was cleared at seed time and never repopulated. Present stock
 * could not be reconciled against anything, so the inventory policy in the ML
 * service — which reads `current_stock` as truth — operated on an unverifiable
 * number, and `lead_time_days` was a declaration nothing could validate.
 *
 * This module derives a stock history from the real sales history instead:
 * an opening balance dated before the first invoice, then demand-driven
 * replenishment events and the purchase orders behind them, walked one day at a
 * time. The ending balance is a consequence of that walk, which is why callers
 * write it back onto the product rather than asserting a number.
 *
 * On the (s, S) rule below
 * ------------------------
 * HANDOFF.md §3.4 warns against reimplementing a model in a second language:
 * `backend/src/services/mlClient.js` used to reimplement every model with
 * different thresholds, so one store got different answers depending on whether
 * Python happened to be running. That rule is about *serving a forecast*, and
 * this is *generating input data*. The seeder is not answering "what should be
 * ordered" for the merchant — it is producing a plausible history for the
 * models to read. It therefore does not import or mirror the Python policy, but
 * it does read the same `lead_time_days` field the ML reads
 * (ml-service/app/recommendation/inventory_rules.py), so the two stay
 * consistent without being coupled.
 *
 * Nothing here fabricates a DAMAGE or ADJUSTMENT event. Nothing in the data
 * implies any occurred, and inventing one would breach HANDOFF.md §10.1. The
 * writer supports those types through the live API; the generator emits none.
 */

const MS_PER_DAY = 86400000;

/** Days of cover ordered on top of lead time, mirroring a weekly review cycle. */
const REVIEW_PERIOD_DAYS = 7;

/** Window used to estimate current daily velocity, in days. */
const VELOCITY_WINDOW_DAYS = 14;

/** Fallback when a product carries no lead time of its own. */
const DEFAULT_LEAD_TIME_DAYS = 3;

/** Placed on every generated row so the ledger is attributable. */
const LEDGER_AUTHOR = 'System (seed)';

/**
 * Normalise any stored date into a `YYYY-MM-DD` key.
 * Returns null for anything unparseable, so a bad row is skipped rather than
 * silently becoming today.
 */
function dayKey(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

const keyToTime = (key) => new Date(`${key}T00:00:00Z`).getTime();
const timeToKey = (time) => new Date(time).toISOString().slice(0, 10);
const addDays = (key, days) => timeToKey(keyToTime(key) + days * MS_PER_DAY);
const daysBetween = (from, to) => Math.round((keyToTime(to) - keyToTime(from)) / MS_PER_DAY);

/** Timestamp for a generated row, pinned to a stable hour so runs are diffable. */
const stampFor = (key) => `${key}T09:00:00.000Z`;

/**
 * Per-product daily units sold, read from invoice line items.
 *
 * Invoices carry their items nested rather than in the `invoice_items` table
 * (which is empty), so the nested array is the source of truth here.
 */
function collectSales(invoices, knownProductIds) {
  const salesByProduct = new Map();
  const saleDates = new Set();
  let invoicesWithoutItems = 0;
  let itemsForUnknownProducts = 0;

  for (const invoice of invoices) {
    const key = dayKey(invoice.date);
    if (!key) continue;
    saleDates.add(key);

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    if (items.length === 0) {
      // Revenue is real but the units sold are unknowable, so this day must not
      // be read as "zero units sold". Counted and reported instead.
      invoicesWithoutItems += 1;
      continue;
    }

    for (const item of items) {
      const productId = item.product_id;
      if (!productId || !knownProductIds.has(productId)) {
        itemsForUnknownProducts += 1;
        continue;
      }
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      let byDay = salesByProduct.get(productId);
      if (!byDay) {
        byDay = new Map();
        salesByProduct.set(productId, byDay);
      }
      byDay.set(key, (byDay.get(key) || 0) + quantity);
    }
  }

  return { salesByProduct, saleDates, invoicesWithoutItems, itemsForUnknownProducts };
}

/**
 * Mean daily units over the trailing window ending the day before `today`.
 *
 * Deliberately returns 0 when the window holds no sales: a product that has
 * stopped selling must not keep being reordered. There is no fallback to the
 * product's lifetime mean, which would do exactly that.
 */
function trailingVelocity(byDay, today, elapsedDays) {
  const window = Math.min(VELOCITY_WINDOW_DAYS, elapsedDays);
  if (window <= 0 || !byDay) return 0;

  let total = 0;
  for (let back = 1; back <= window; back += 1) {
    total += byDay.get(addDays(today, -back)) || 0;
  }
  return total / window;
}

/**
 * Rebuild a store's supply-side stock history from its sales history.
 *
 * Returns the transactions and purchase orders to persist, plus the ending
 * balance per product. The caller writes that balance onto the product, so
 * present stock becomes a result of the ledger rather than a magic number.
 *
 * `openingBalances` exists because this function both reads and writes present
 * stock: without it, running it a second time would treat the balance it just
 * computed as the opening balance and compound every restock. A caller that has
 * the original openings (read back from stored OPENING rows) passes them to get
 * a reproducible replay.
 *
 * @param {object}   args
 * @param {Array}    args.products          Product records (need id, stock_quantity, lead_time_days, min_stock_level).
 * @param {Array}    args.invoices          Invoice records with nested items[].
 * @param {string}   args.storeId
 * @param {object}   [args.suppliers]       Optional, used to report lead-time mismatches.
 * @param {Map}      [args.openingBalances] Optional product id -> opening balance override.
 * @param {number}   [args.reviewPeriodDays]
 */
function simulateStockHistory({
  products,
  invoices,
  storeId,
  suppliers = [],
  openingBalances = null,
  reviewPeriodDays = REVIEW_PERIOD_DAYS
}) {
  const notes = [];

  const productList = (products || []).filter((p) => p && p.id);
  if (productList.length === 0) {
    return {
      transactions: [],
      purchaseOrders: [],
      finalStock: new Map(),
      notes: ['No products supplied, so no stock history was generated.']
    };
  }

  const knownProductIds = new Set(productList.map((p) => p.id));
  const { salesByProduct, saleDates, invoicesWithoutItems, itemsForUnknownProducts } =
    collectSales(invoices || [], knownProductIds);

  const allDates = [...saleDates].sort();
  if (allDates.length === 0) {
    return {
      transactions: [],
      purchaseOrders: [],
      finalStock: new Map(),
      notes: ['No dated sales found, so no stock history was generated.']
    };
  }

  const firstDate = allDates[0];
  const lastDate = allDates[allDates.length - 1];
  // The opening balance is dated the day before the first sale, so the walk
  // below covers exactly the observed window.
  const openingDate = addDays(firstDate, -1);

  const supplierById = new Map((suppliers || []).map((s) => [s.id, s]));

  const transactions = [];
  const purchaseOrders = [];
  const finalStock = new Map();
  const leadTimeMismatches = [];

  let transactionSeq = 0;
  let orderSeq = 0;
  let productsRestocked = 0;
  let productsWithoutDemand = 0;

  for (const product of productList) {
    const override = openingBalances && openingBalances.has(product.id)
      ? openingBalances.get(product.id)
      : null;
    const openingSource = override != null && Number.isFinite(Number(override))
      ? Number(override)
      : product.stock_quantity;
    const openingBalance = Math.max(0, Math.floor(Number(openingSource) || 0));
    const byDay = salesByProduct.get(product.id) || new Map();

    const declaredLeadTime = Number(product.lead_time_days);
    const leadTimeDays = Math.max(
      1,
      Math.round(
        Number.isFinite(declaredLeadTime) && declaredLeadTime > 0
          ? declaredLeadTime
          : DEFAULT_LEAD_TIME_DAYS
      )
    );

    const supplier = product.supplier_id ? supplierById.get(product.supplier_id) : null;
    if (supplier) {
      const supplierLeadTime = Number(supplier.lead_time_days);
      if (Number.isFinite(supplierLeadTime) && supplierLeadTime !== leadTimeDays) {
        // The ML reads the product's value, so that is what the simulation uses.
        // Reported rather than reconciled in either direction.
        leadTimeMismatches.push(
          `${product.name}: product lead_time_days=${leadTimeDays} but supplier ` +
            `"${supplier.name}" declares ${supplierLeadTime}`
        );
      }
    }

    const minStockRaw = Number(product.min_stock_level);
    const minStockFloor = Number.isFinite(minStockRaw) && minStockRaw > 0 ? minStockRaw : 0;

    let stock = openingBalance;
    const openingRow = {
      store_id: storeId,
      product_id: product.id,
      product_name: product.name,
      type: 'OPENING',
      adjustment_type: 'OPENING',
      quantity: openingBalance,
      previous_stock: 0,
      new_stock: openingBalance,
      reference_id: 'OPENING-BALANCE',
      reason: `Opening balance carried into the ledger on ${openingDate}`,
      notes: 'Opening balance',
      created_by: LEDGER_AUTHOR,
      created_at: stampFor(openingDate)
    };
    transactionSeq += 1;
    transactions.push({ id: `itx_${storeId}_${String(transactionSeq).padStart(5, '0')}`, ...openingRow });

    /** Orders raised but not yet delivered. At most one at a time per product. */
    const inFlight = [];

    let elapsedDays = 0;
    let restockCount = 0;

    for (let today = firstDate; today <= lastDate; today = addDays(today, 1)) {
      // 1. Deliver anything due. `<=` because a delivery that slipped past its
      //    expected date still arrives.
      for (let i = inFlight.length - 1; i >= 0; i -= 1) {
        const order = inFlight[i];
        if (keyToTime(order.expected_at) > keyToTime(today)) continue;

        const previousStock = stock;
        stock += order.quantity;
        order.status = 'RECEIVED';
        order.received_at = today;

        transactionSeq += 1;
        transactions.push({
          id: `itx_${storeId}_${String(transactionSeq).padStart(5, '0')}`,
          store_id: storeId,
          product_id: product.id,
          product_name: product.name,
          type: 'RESTOCK',
          adjustment_type: 'RESTOCK',
          quantity: order.quantity,
          previous_stock: previousStock,
          new_stock: stock,
          reference_id: order.id,
          reason: `Goods received against ${order.id}`,
          notes: order.trigger === 'reorder_point' ? 'Reorder point replenishment' : 'Replenishment',
          created_by: LEDGER_AUTHOR,
          created_at: stampFor(today)
        });
        restockCount += 1;

        inFlight.splice(i, 1);
      }

      // 2. Apply that day's sales. Clamped at zero because a negative balance is
      //    not a state the store can be in; unbounded demand past zero is a
      //    stockout, not negative inventory.
      const unitsSold = byDay.get(today) || 0;
      if (unitsSold > 0) {
        stock = Math.max(0, stock - unitsSold);
      }

      // 3. Replenishment decision, after the day's sales are known.
      elapsedDays += 1;
      if (inFlight.length === 0) {
        const velocity = trailingVelocity(byDay, today, elapsedDays);

        if (velocity > 0) {
          const reorderPoint = Math.max(minStockFloor, Math.ceil(velocity * leadTimeDays + minStockFloor * 0.3));
          const orderUpTo = Math.max(minStockFloor * 2.5, Math.ceil(reorderPoint + velocity * (leadTimeDays + reviewPeriodDays * 2)));

          if (stock <= reorderPoint && orderUpTo > stock) {
            const minOrderBatch = Math.max(20, Math.ceil(minStockFloor * 1.5));
            const quantity = Math.max(minOrderBatch, Math.ceil(orderUpTo - stock));
            orderSeq += 1;
            const expectedAt = addDays(today, leadTimeDays);

            purchaseOrders.push({
              id: `PO-${today.slice(0, 4)}-${String(orderSeq).padStart(4, '0')}`,
              store_id: storeId,
              supplier_id: product.supplier_id || null,
              product_id: product.id,
              product_name: product.name,
              quantity,
              unit_cost: Number(product.cost_price) || 0,
              ordered_at: today,
              expected_at: expectedAt,
              received_at: null,
              status: 'ORDERED',
              trigger: 'reorder_point',
              created_by: LEDGER_AUTHOR,
              created_at: stampFor(today)
            });

            // Kept in step with the array just pushed to, so receiving mutates
            // the same object the caller will persist.
            inFlight.push(purchaseOrders[purchaseOrders.length - 1]);
          }
        }
      }
    }

    if (restockCount > 0) productsRestocked += 1;
    else productsWithoutDemand += 1;

    finalStock.set(product.id, stock);
  }

  notes.push(
    `Walked ${daysBetween(firstDate, lastDate) + 1} days ` +
      `(${firstDate} to ${lastDate}) for ${productList.length} products.`
  );
  notes.push(
    `${productsRestocked} products were replenished; ${productsWithoutDemand} had no ` +
      'demand in the window and kept their opening balance.'
  );
  if (invoicesWithoutItems > 0) {
    notes.push(
      `${invoicesWithoutItems} invoices carry no items[], so their units sold could not ` +
        'be applied to stock. Their revenue still counts in the daily sales series.'
    );
  }
  if (itemsForUnknownProducts > 0) {
    notes.push(
      `${itemsForUnknownProducts} line items referenced a product not in the catalog ` +
        'and were skipped.'
    );
  }
  if (leadTimeMismatches.length > 0) {
    notes.push(
      `${leadTimeMismatches.length} product/supplier lead-time mismatches (the product's ` +
        'value was used, matching what the ML service reads):'
    );
    leadTimeMismatches.forEach((m) => notes.push(`  - ${m}`));
  }

  return { transactions, purchaseOrders, finalStock, notes, firstDate, lastDate, openingDate };
}

/**
 * Verify that stored stock state is reproducible from the sales history.
 *
 * A totals identity (`final == opening + ΣRESTOCK − Σsales`) is *not* a valid
 * test here: the daily walk clamps at zero, so a day that sells more than is on
 * hand removes less than it sold, and the shortfall depends on the path taken to
 * get there. Summing the ledger therefore cannot recompute the balance.
 *
 * What is checked instead is stronger and exact — the stored state is re-derived
 * from the rule and compared, field by field:
 *   - every product's stored `stock_quantity` equals the replayed ending balance
 *   - the stored ledger matches the replayed ledger row for row
 *   - no product ends negative
 *   - every received PO arrived exactly `lead_time_days` after it was raised
 *
 * A product is only reported as ledger-covered if it actually has an OPENING row;
 * otherwise it is "not in ledger" rather than "unbalanced", so an un-backfilled
 * database reports honestly instead of as 46 failures.
 */
function reconcileLedger({
  products,
  invoices,
  suppliers = [],
  transactions = [],
  purchaseOrders = [],
  storeId
}) {
  const productIds = new Set((products || []).map((p) => p.id));

  // Replay from the *original* openings recorded in the ledger, not from the
  // balances this ledger produced.
  const openingBalances = new Map();
  for (const tx of transactions) {
    if (tx.store_id !== storeId || tx.type !== 'OPENING') continue;
    openingBalances.set(tx.product_id, Number(tx.quantity) || 0);
  }

  const simulation = simulateStockHistory({
    products,
    invoices,
    storeId,
    suppliers,
    openingBalances: openingBalances.size > 0 ? openingBalances : null
  });

  const group = (rows) => {
    const byProduct = new Map();
    for (const row of rows) {
      if (row.store_id !== storeId) continue;
      if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, []);
      byProduct.get(row.product_id).push(row);
    }
    return byProduct;
  };

  const expectedTx = group(simulation.transactions);
  const storedTx = group(transactions);
  const storedOrders = new Map();
  for (const po of purchaseOrders) {
    if (po.store_id !== storeId) continue;
    if (!storedOrders.has(po.product_id)) storedOrders.set(po.product_id, []);
    storedOrders.get(po.product_id).push(po);
  }

  const results = [];
  const allProductIds = new Set([...productIds, ...storedTx.keys(), ...expectedTx.keys()]);

  for (const productId of allProductIds) {
    const product = (products || []).find((p) => p.id === productId);
    const storedAll = (storedTx.get(productId) || []).slice()
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const expected = expectedTx.get(productId) || [];

    // Rows this generator would have written, identified by author. Anything else
    // is pre-existing history (a sale the app recorded, or a row from an earlier
    // database lifetime) and is retained and reported rather than counted as a
    // discrepancy — the ledger is not ours to rewrite.
    const expectedById = new Map(expected.map((t) => [t.id, t]));
    const preExisting = storedAll.filter(
      (t) => t.created_by !== LEDGER_AUTHOR && !expectedById.has(t.id)
    );
    const preExistingIds = new Set(preExisting.map((t) => t.id));
    const stored = storedAll.filter((t) => !preExistingIds.has(t.id));

    const opening = stored.find((t) => t.type === 'OPENING');
    const covered = Boolean(opening);
    const restocked = stored
      .filter((t) => t.type === 'RESTOCK' || t.type === 'IN')
      .reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
    const otherAdjustments = stored
      .filter((t) => t.type !== 'OPENING' && t.type !== 'RESTOCK' && t.type !== 'IN')
      .reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);

    // Row-for-row agreement, cheap because the generated ids are positional.
    const missing = expected.filter((t) => !stored.some((s) => s.id === t.id)).length;
    const extra = stored.filter((s) => !expectedById.has(s.id)).length;
    const quantityMismatch = stored.filter((s) => {
      const match = expectedById.get(s.id);
      return match && Number(match.quantity) !== Number(s.quantity);
    }).length;

    // Lead time actually achieved, read off the purchase orders rather than assumed.
    const leadTimeChecks = [];
    for (const po of storedOrders.get(productId) || []) {
      if (po.status !== 'RECEIVED' || !po.received_at || !po.ordered_at) continue;
      const actual = daysBetween(dayKey(po.ordered_at), dayKey(po.received_at));
      const declared = Math.max(
        1,
        Math.round(Number(product?.lead_time_days) || DEFAULT_LEAD_TIME_DAYS)
      );
      leadTimeChecks.push({ id: po.id, actual, declared, ok: actual === declared });
    }

    const simulatedFinal = simulation.finalStock.get(productId);
    const storedStock = product ? Number(product.stock_quantity) || 0 : null;
    const hasSimulation = simulatedFinal !== undefined;

    results.push({
      product_id: productId,
      product_name: product?.name || '(unknown product)',
      covered,
      opening: opening ? Number(opening.quantity) || 0 : null,
      restocked,
      other_adjustments: otherAdjustments,
      stored_rows: stored.length,
      expected_rows: expected.length,
      pre_existing_rows: preExisting.length,
      pre_existing_quantity: preExisting.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0),
      missing_rows: missing,
      extra_rows: extra,
      quantity_mismatches: quantityMismatch,
      simulated_final: hasSimulation ? simulatedFinal : null,
      stored_stock: storedStock,
      balanced: covered && hasSimulation && simulatedFinal === storedStock,
      lead_time_checks: leadTimeChecks,
      lead_time_ok: leadTimeChecks.every((c) => c.ok),
      negative: storedStock !== null && storedStock < 0
    });
  }

  return {
    products: results,
    notes: simulation.notes,
    firstDate: simulation.firstDate,
    lastDate: simulation.lastDate,
    openingDate: simulation.openingDate
  };
}

/**
 * Work out what each product's stock was before anything was recorded.
 *
 * Present `stock_quantity` is not safe to use as the opening balance for a
 * product that has already been sold through the app: `invoiceController`
 * decremented it at the time, and the simulation would decrement it a second
 * time from the same invoice. The balance *before the first recorded movement*
 * is the earliest row's `previous_stock`, which is what this returns.
 *
 * Products with no recorded movement have never been touched, so their stored
 * balance is already the opening one.
 */
function deriveOpeningBalances({ products, transactions, storeId }) {
  const earliest = new Map();
  for (const tx of transactions || []) {
    if (tx.store_id !== storeId) continue;
    if (tx.previous_stock == null) continue;
    const seen = earliest.get(tx.product_id);
    if (!seen || String(tx.created_at) < String(seen.created_at)) {
      earliest.set(tx.product_id, tx);
    }
  }

  const balances = new Map();
  const sources = new Map();
  for (const product of products || []) {
    const row = earliest.get(product.id);
    if (row) {
      balances.set(product.id, Number(row.previous_stock) || 0);
      sources.set(product.id, `ledger (${row.id} previous_stock)`);
    } else {
      balances.set(product.id, Number(product.stock_quantity) || 0);
      sources.set(product.id, 'product.stock_quantity (never adjusted)');
    }
  }

  return { balances, sources };
}

module.exports = {
  simulateStockHistory,
  reconcileLedger,
  deriveOpeningBalances,
  dayKey,
  addDays,
  daysBetween,
  REVIEW_PERIOD_DAYS,
  VELOCITY_WINDOW_DAYS,
  DEFAULT_LEAD_TIME_DAYS,
  LEDGER_AUTHOR
};
