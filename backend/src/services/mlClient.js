const axios = require('axios');

const ML_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Client for the Python ML service.
 *
 * Every method here previously had its own bespoke JavaScript "fallback" that
 * reimplemented the model with different rules — a stockout buffer of +15 in
 * JS versus the Python policy, DEAD STOCK at >45 days in JS versus >60 in
 * Python, a hardcoded `sales_growth_predicted_pct: 12.8`, an invented
 * `Electricity > 9000` anomaly threshold, invented default averages of 18500
 * and 1350. The same store therefore received different answers depending on
 * whether a Python process happened to be listening.
 *
 * All of that is gone. There is now exactly one degraded mode, it is labelled
 * on every response, and it never invents a number the data does not support:
 *
 *   - Sales falls back to **seasonal-naive** (same weekday, last observed
 *     week), computed from the caller's real history. This is the same
 *     baseline the Python model is scored against, so the degraded answer is a
 *     recognised point of comparison rather than a rival model.
 *   - Everything else returns a labelled empty payload. A demand forecast, a
 *     reorder quantity, or a DEAD STOCK label cannot be honestly produced
 *     without the trained model, so none is produced.
 *
 * Both paths carry `degraded` and `method`, so a caller can always tell which
 * it received and never has to guess whether a number was measured.
 */

const DEGRADED_REASON =
  'The ML service was unreachable, so no trained model was available. ' +
  'This response is a labelled fallback, not a model prediction.';

class MLClient {
  constructor() {
    this.client = axios.create({
      baseURL: ML_BASE_URL,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async _post(path, payload, label) {
    if (process.env.ML_DISCONNECTED === 'true') {
      return { error: new Error('ML pipeline is disconnected from the platform.') };
    }
    try {
      const response = await this.client.post(path, payload);
      // Mark the live path too, so callers can branch on one field.
      return { degraded: false, method: 'ml_service', ...response.data };
    } catch (error) {
      console.warn(
        `[mlClient] ${label}: ML service unreachable (${error.message}). ` +
          'Returning labelled degraded response.'
      );
      return { error };
    }
  }

  async predictSales(payload) {
    const result = await this._post('/ml/sales/predict', payload, 'sales');
    if (!result.error) return result;
    return this._degradedSales(payload, result.error);
  }

  async predictDemand(payload) {
    const result = await this._post('/ml/demand/predict', payload, 'demand');
    if (!result.error) return result;
    return this._degradedDemand(payload, result.error);
  }

  async classifyCatalog(payload) {
    const result = await this._post('/ml/catalog/classify', payload, 'catalog');
    if (!result.error) return result;
    return this._degradedCatalog(payload, result.error);
  }

  async predictExpenses(payload) {
    const result = await this._post('/ml/expense/predict', payload, 'expenses');
    if (!result.error) return result;
    return this._degradedExpenses(payload, result.error);
  }

  async detectExpenseAnomalies(payload) {
    const result = await this._post('/ml/expense/anomalies', payload, 'anomalies');
    if (!result.error) return result;
    return this._degradedAnomalies(payload, result.error);
  }

  async getExecutiveInsights(payload) {
    const result = await this._post('/ml/insights/summary', payload, 'insights');
    if (!result.error) return result;
    return this._degradedInsights(payload, result.error);
  }

  // --- Degraded mode ------------------------------------------------------

  _envelope(error) {
    return {
      degraded: true,
      method: 'unavailable',
      degraded_reason: DEGRADED_REASON,
      degraded_error: error && error.message ? error.message : String(error)
    };
  }

  /**
   * Seasonal-naive: predict each future day as the value observed on the same
   * weekday one week earlier. No trend, no dampening, no invented multipliers
   * — only values present in `history`.
   */
  _degradedSales(payload, error) {
    const days = Number(payload.days) || 7;
    const history = Array.isArray(payload.history) ? payload.history : [];

    const byDate = new Map();
    for (const row of history) {
      if (!row || !row.date) continue;
      const key = String(row.date).slice(0, 10);
      byDate.set(key, (byDate.get(key) || 0) + (Number(row.amount) || 0));
    }

    const observed = [...byDate.entries()]
      .map(([date, amount]) => ({ date, amount, time: Date.parse(date) }))
      .filter((r) => Number.isFinite(r.time))
      .sort((a, b) => a.time - b.time);

    if (observed.length < 8) {
      return {
        ...this._envelope(error),
        forecast_days: 0,
        total_forecasted_sales: 0,
        trend_percentage: 0,
        daily_forecasts: [],
        confidence: 0,
        status: 'insufficient_data',
        message:
          'Seasonal-naive fallback needs at least 8 observed days of history ' +
          `to reference the same weekday last week; received ${observed.length}.`
      };
    }

    const lastTime = observed[observed.length - 1].time;
    const firstTime = observed[0].time;
    const lastSeven = observed.slice(-7);
    const recentTotal = lastSeven.reduce((sum, r) => sum + r.amount, 0);

    const dailyForecasts = [];
    let total = 0;
    for (let step = 1; step <= days; step += 1) {
      const targetTime = lastTime + step * 86400000;
      const referenceTime = targetTime - 7 * 86400000;
      if (referenceTime < firstTime) break;
      const referenceDate = new Date(referenceTime).toISOString().slice(0, 10);
      // A date inside the observed range with no record is a day the store
      // sold nothing — the same zero-fill the Python service applies — rather
      // than missing data, so it is a legitimate seasonal-naive reference.
      const reference = byDate.has(referenceDate) ? byDate.get(referenceDate) : 0;
      total += reference;
      dailyForecasts.push({
        date: new Date(targetTime).toISOString().slice(0, 10),
        predicted_sales: Math.round(reference * 100) / 100,
        lower_bound: Math.round(reference * 100) / 100,
        upper_bound: Math.round(reference * 100) / 100,
        tag: '↩️ Seasonal-Naive Fallback'
      });
    }

    const comparableActual = dailyForecasts.slice(0, 7).reduce((sum, d) => sum + d.predicted_sales, 0);
    const trendPct =
      recentTotal > 0 ? Math.round(((comparableActual - recentTotal) / recentTotal) * 1000) / 10 : 0;

    return {
      ...this._envelope(error),
      method: 'seasonal_naive',
      forecast_days: dailyForecasts.length,
      total_forecasted_sales: Math.round(total * 100) / 100,
      trend_percentage: trendPct,
      daily_forecasts: dailyForecasts,
      // No backtest was run, so no accuracy-derived confidence exists.
      confidence: 0,
      status: 'degraded',
      message:
        'Seasonal-naive baseline: each day is predicted as the same weekday ' +
        'one week earlier. Prediction intervals are unavailable, so the bounds ' +
        'equal the point forecast.'
    };
  }

  _degradedDemand(payload, error) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    return {
      ...this._envelope(error),
      results: items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        category: item.category,
        current_stock: item.current_stock,
        predicted_demand_units: null,
        projected_shortage: null,
        status: 'Unavailable',
        recommended_order_quantity: null,
        reorder_urgency: 'Unknown',
        confidence: 0
      })),
      total_shortage_items: 0,
      status: 'degraded',
      message:
        'Demand forecasting and reorder quantities require the trained model. ' +
        'No estimate is produced rather than returning an unsupported one.'
    };
  }

  _degradedCatalog(payload, error) {
    return {
      ...this._envelope(error),
      classifications: [],
      summary: {},
      status: 'degraded',
      message:
        'Catalog classification requires the trained segmentation model. ' +
        'No labels are produced rather than assigning unsupported ones.'
    };
  }

  _degradedExpenses(payload, error) {
    return {
      ...this._envelope(error),
      total_predicted_expense: 0,
      forecast_months: Number(payload.forecast_months) || 1,
      category_breakdown: [],
      status: 'degraded',
      message: 'Expense forecasting requires the trained model.'
    };
  }

  _degradedAnomalies(payload, error) {
    const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
    return {
      ...this._envelope(error),
      anomalies: expenses.map((e) => ({
        id: e.id,
        date: e.date,
        category: e.category,
        amount: e.amount,
        expected_range: null,
        anomaly_score: null,
        is_anomaly: false,
        reason: 'Not scored: the ML service was unreachable, so no baseline was available.'
      })),
      total_anomalies_detected: 0,
      status: 'degraded',
      message:
        'Anomaly detection needs a category baseline. Nothing is flagged when ' +
        'that baseline cannot be computed, because an unflagged expense is a ' +
        'safer default than a false alarm.'
    };
  }

  _degradedInsights(payload, error) {
    return {
      ...this._envelope(error),
      // Previously hardcoded to 12.8 regardless of the data.
      sales_growth_predicted_pct: 0,
      expected_revenue_next_period: 0,
      expected_expense_next_period: 0,
      expected_cogs: 0,
      expected_gross_profit: 0,
      predicted_net_profit: 0,
      profit_margin_pct: 0,
      critical_alerts: [],
      top_recommended_actions: [],
      status: 'degraded',
      message:
        'Executive insights combine every model and require the ML service.'
    };
  }
}

module.exports = new MLClient();
