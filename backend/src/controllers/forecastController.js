const db = require('../config/db');
const mlClient = require('../services/mlClient');

const getStoreId = (req) => req.storeId || req.user?.store_id || 'store_dwdm_001';

const MS_PER_DAY = 86400000;
const DAYS_PER_MONTH = 30.44;

/** Settings the AI Forecasting screen exposes, forwarded to the models. */
const ANOMALY_Z_BY_SENSITIVITY = { low: 4.5, balanced: 3.5, high: 2.0 };

function getMinStockFloor(req) {
  const raw = Number(req.query.min_stock_floor);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function getZThreshold(req) {
  const direct = Number(req.query.z_threshold);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const band = ANOMALY_Z_BY_SENSITIVITY[req.query.sensitivity];
  return band ?? undefined;
}

/**
 * Convert whatever date format the datastore holds into a `YYYY-MM-DD` key.
 * Returns null for anything unparseable so a bad row is skipped rather than
 * silently becoming "today".
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

function daysBetween(fromKey, toKey) {
  return Math.round((keyToTime(toKey) - keyToTime(fromKey)) / MS_PER_DAY);
}

/** Units sold in the window [end - offset - span + 1 .. end - offset]. */
function windowUnits(skuMap, endKey, offsetDays, spanDays) {
  if (!skuMap) return 0;
  const end = keyToTime(endKey) - offsetDays * MS_PER_DAY;
  const start = end - (spanDays - 1) * MS_PER_DAY;
  let total = 0;
  for (let t = start; t <= end; t += MS_PER_DAY) {
    total += skuMap.get(timeToKey(t)) || 0;
  }
  return total;
}

/**
 * Single pass over the invoices, producing every aggregate the forecast
 * endpoints need.
 *
 * The previous controller re-scanned the full invoice list once per product
 * per day (46 products x 15 days x ~2,140 invoices, each with a nested item
 * loop) for every request. Everything below is derived in one traversal.
 */
function buildHistory(storeId) {
  const invoices = db.table('invoices').find((i) => i.store_id === storeId);
  const todayKey = timeToKey(Date.now());

  const daily = new Map();
  const skuDaily = new Map();
  const skuStats = new Map();
  let lineRevenue = 0;
  let lineCost = 0;

  for (const invoice of invoices) {
    const key = dayKey(invoice.date);
    if (!key) continue;

    const entry = daily.get(key) || { date: key, amount: 0, order_count: 0, quantity: 0 };
    entry.amount += Number(invoice.total_amount || 0);
    entry.order_count += 1;

    for (const item of invoice.items || []) {
      const productId = item.product_id;
      if (!productId) continue;

      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price ?? 0);
      const costPrice = Number(item.cost_price ?? 0);
      const lineTotal = Number(item.total_amount ?? unitPrice * quantity);

      entry.quantity += quantity;

      let skuMap = skuDaily.get(productId);
      if (!skuMap) {
        skuMap = new Map();
        skuDaily.set(productId, skuMap);
      }
      skuMap.set(key, (skuMap.get(key) || 0) + quantity);

      const stats =
        skuStats.get(productId) || { units: 0, revenue: 0, cost: 0, lastDate: null };
      stats.units += quantity;
      stats.revenue += lineTotal;
      stats.cost += costPrice * quantity;
      if (!stats.lastDate || key > stats.lastDate) stats.lastDate = key;
      skuStats.set(productId, stats);

      // COGS basis: line-level revenue paired with line-level cost, so the
      // ratio is internally consistent.
      lineRevenue += lineTotal;
      lineCost += costPrice * quantity;
    }

    daily.set(key, entry);
  }

  const observedKeys = [...daily.keys()].sort();
  const firstKey = observedKeys[0] || null;
  // The origin of a forecast is today. Extending the series to today records
  // the days since the last invoice as the zero-sales days they were, instead
  // of leaving a gap the model would read as "yesterday".
  const lastObservedKey = observedKeys[observedKeys.length - 1] || null;
  const endKey =
    lastObservedKey && lastObservedKey > todayKey ? lastObservedKey : todayKey;

  return {
    invoices,
    daily,
    skuDaily,
    skuStats,
    firstKey,
    endKey,
    // Real span of the observed window, replacing the hardcoded 30 that made
    // every "per day" normalisation a no-op.
    observationDays: firstKey ? daysBetween(firstKey, endKey) + 1 : 0,
    cogsRatio: lineRevenue > 0 ? lineCost / lineRevenue : null,
    hasLineItems: lineRevenue > 0
  };
}

/**
 * Zero-fill the calendar so `shift(1)` means "yesterday".
 *
 * Without this, a day with no invoices simply did not exist in the series, so
 * every lag and rolling feature silently spanned a variable number of days.
 */
function completeDailySeries(history) {
  const { daily, firstKey, endKey } = history;
  if (!firstKey || !endKey) return [];

  const out = [];
  for (let t = keyToTime(firstKey); t <= keyToTime(endKey); t += MS_PER_DAY) {
    const key = timeToKey(t);
    const entry = daily.get(key);
    out.push(
      entry
        ? { ...entry }
        : { date: key, amount: 0, order_count: 0, quantity: 0 }
    );
  }
  return out;
}

function sparseSkuHistory(skuMap) {
  if (!skuMap) return [];
  return [...skuMap.entries()]
    .filter(([, units]) => units > 0)
    .map(([date, units]) => ({ date, units }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function demandItem(prod, history) {
  return {
    product_id: prod.id,
    product_name: prod.name,
    category: prod.category_name || 'General',
    current_stock: Number(prod.stock_quantity || 0),
    unit_price: Number(prod.selling_price || 0),
    cost_price: prod.cost_price != null ? Number(prod.cost_price) : undefined,
    lead_time_days: prod.lead_time_days || 3,
    min_stock_level: prod.min_stock_level != null ? Number(prod.min_stock_level) : undefined,
    // Real dated history rather than a flat array of trailing daily counts,
    // which discarded every calendar gap the SKU actually had.
    sales_history: sparseSkuHistory(history.skuDaily.get(prod.id))
  };
}

exports.getSalesForecast = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    const forecastDays = parseInt(req.query.days, 10) || 7;

    const history = buildHistory(storeId);
    if (history.invoices.length === 0) {
      return res.json({
        forecast_days: forecastDays,
        total_forecasted_sales: 0,
        trend_percentage: 0,
        daily_forecasts: [],
        status: 'insufficient_data',
        message: 'No sales history yet. Create invoices to generate predictions.'
      });
    }

    const result = await mlClient.predictSales({
      days: forecastDays,
      history: completeDailySeries(history),
      store_id: storeId
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDemandForecast = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    const forecastDays = parseInt(req.query.days, 10) || 7;

    const products = db.table('products').find((p) => p.store_id === storeId);
    if (products.length === 0) {
      return res.json({
        forecast_days: forecastDays,
        results: [],
        item_predictions: [],
        critical_reorders: [],
        total_reorder_cost: 0,
        message: 'No products in catalog yet.'
      });
    }

    const history = buildHistory(storeId);
    const result = await mlClient.predictDemand({
      items: products.map((prod) => demandItem(prod, history)),
      forecast_days: forecastDays,
      store_id: storeId,
      min_stock_floor: getMinStockFloor(req)
    });

    const priceById = new Map(
      products.map((prod) => [prod.id, Number(prod.cost_price ?? prod.selling_price ?? 0)])
    );
    const rows = result.results || [];
    res.json({
      ...result,
      item_predictions: rows,
      critical_reorders: rows.filter(
        (r) => r.status === 'Critical Shortage' || r.status === 'Out of Stock'
      ),
      total_reorder_cost: Math.round(
        rows.reduce(
          (sum, r) =>
            sum + (r.recommended_order_quantity || 0) * (priceById.get(r.product_id) || 0),
          0
        )
      )
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCatalogClassifications = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    const products = db.table('products').find((p) => p.store_id === storeId);

    if (products.length === 0) {
      return res.json({
        classifications: [],
        summary: {},
        fast_moving_count: 0,
        slow_moving_count: 0,
        dead_stock_count: 0,
        message: 'No catalog products to classify.'
      });
    }

    const history = buildHistory(storeId);
    const { endKey, observationDays } = history;

    const payloadProducts = products.map((prod) => {
      const stats = history.skuStats.get(prod.id) || {
        units: 0,
        revenue: 0,
        cost: 0,
        lastDate: null
      };
      const skuMap = history.skuDaily.get(prod.id);

      let lastSaleDaysAgo = null;
      if (stats.lastDate) {
        lastSaleDaysAgo = daysBetween(stats.lastDate, endKey);
      }
      // `lastSaleDaysAgo === 999 ? 0 : lastSaleDaysAgo` used to coerce every
      // never-sold product into "sold today", which made DEAD STOCK
      // unreachable for exactly the products it exists to catch. A product
      // with no sales now reports null and the model reads it as maximally
      // stale.

      return {
        product_id: prod.id,
        product_name: prod.name,
        category: prod.category_name || 'General',
        total_units_sold: stats.units,
        revenue_generated: stats.revenue,
        last_sale_days_ago: lastSaleDaysAgo,
        unit_price: Number(prod.selling_price || 0),
        cost_price: prod.cost_price != null ? Number(prod.cost_price) : undefined,
        active_days: skuMap ? skuMap.size : 0,
        units_last_28d: windowUnits(skuMap, endKey, 0, 28),
        units_prior_28d: windowUnits(skuMap, endKey, 28, 28),
        stock_turnover_ratio: stats.units / Math.max(Number(prod.stock_quantity || 0), 1),
        days_in_inventory: observationDays
      };
    });

    const result = await mlClient.classifyCatalog({
      products: payloadProducts,
      observation_days: observationDays,
      store_id: storeId
    });

    const summary = result.summary || {};
    res.json({
      ...result,
      fast_moving_count: (summary['HIGH DEMAND'] || 0) + (summary['MEDIUM DEMAND'] || 0),
      slow_moving_count: summary['SLOW MOVING'] || 0,
      dead_stock_count: summary['DEAD STOCK'] || 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getExpenseForecastAndAnomalies = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    const forecastDays = parseInt(req.query.days, 10) || 7;
    const forecastMonths = Math.max(1, Math.round(forecastDays / DAYS_PER_MONTH));
    const expenses = db.table('expenses').find((e) => e.store_id === storeId);

    if (expenses.length === 0) {
      return res.json({
        expense_forecast: {
          forecast_months: forecastMonths,
          total_predicted_expense: 0,
          category_breakdown: []
        },
        anomalies: [],
        total_anomalies: 0,
        message: 'No expenses recorded yet.'
      });
    }

    const payload = {
      history: expenses,
      forecast_months: forecastMonths,
      forecast_days: forecastDays,
      store_id: storeId
    };
    const [forecastRes, anomaliesRes] = await Promise.all([
      mlClient.predictExpenses(payload),
      mlClient.detectExpenseAnomalies({
        expenses,
        store_id: storeId,
        z_threshold: getZThreshold(req)
      })
    ]);

    res.json({
      expense_forecast: {
        ...forecastRes,
        forecast_days: forecastDays,
        predicted_total_expense: forecastRes.total_predicted_expense
      },
      anomalies: anomaliesRes.anomalies || [],
      total_anomalies: anomaliesRes.total_anomalies_detected || 0,
      degraded: Boolean(forecastRes.degraded || anomaliesRes.degraded)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getExecutiveInsights = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    const forecastDays = parseInt(req.query.days, 10) || 7;
    const products = db.table('products').find((p) => p.store_id === storeId);
    const expenses = db.table('expenses').find((e) => e.store_id === storeId);

    const history = buildHistory(storeId);

    if (products.length === 0 && history.invoices.length === 0) {
      return res.json({
        summary:
          'Welcome! Your store is clean and ready. Add products to your catalog and start issuing invoices to generate real forecasts.',
        stockout_risk_count: 0,
        recommendations: [],
        anomalies_detected: 0
      });
    }

    const result = await mlClient.getExecutiveInsights({
      sales_history: completeDailySeries(history),
      products: products.map((prod) => demandItem(prod, history)),
      expenses,
      forecast_days: forecastDays,
      store_id: storeId,
      // Measured from invoice line items. When the store has no line-item
      // costs the field is omitted and the ML service flags its default
      // assumption instead of presenting it as measured.
      cogs_ratio: history.cogsRatio,
      history_days: history.observationDays,
      min_stock_floor: getMinStockFloor(req),
      z_threshold: getZThreshold(req)
    });

    const alerts = result.critical_alerts || [];
    res.json({
      ...result,
      summary: alerts.length
        ? alerts[0].message
        : 'No critical issues detected in the current forecast window.',
      stockout_risk_count: alerts.filter((a) => a.type === 'INVENTORY').length,
      recommendations: result.top_recommended_actions || [],
      anomalies_detected: result.expense_anomaly_count || 0,
      degraded: Boolean(result.degraded)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
