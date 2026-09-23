const db = require('../config/db');

const getStoreId = (req) => req.storeId || req.user?.store_id || 'store_dwdm_001';

function round2(val) {
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

exports.getExecutiveOverview = (req, res) => {
  const storeId = getStoreId(req);
  const { period = '30', days: customDays, start_date, end_date } = req.query;
  const invoices = db.table('invoices').find(i => i.store_id === storeId);
  const expenses = db.table('expenses').find(e => e.store_id === storeId);
  const products = db.table('products').find(p => p.store_id === storeId);
  const customers = db.table('customers').find(c => c.store_id === storeId);

  const now = new Date();
  let days = 30;
  let periodLabel = 'Past 30 Days';

  let filteredInvoices = invoices;
  let filteredExpenses = expenses;

  // Window bounds as YYYY-MM-DD, used to build the comparison period.
  const toKey = (d) => new Date(d).toISOString().split('T')[0];
  let windowStart = null;
  let windowEnd = null;
  let comparable = false;

  if (start_date && end_date) {
    periodLabel = `${start_date} to ${end_date}`;
    const diffMs = Math.abs(new Date(end_date) - new Date(start_date));
    days = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1, 1);
    windowStart = start_date;
    windowEnd = end_date;
    comparable = true;
    filteredInvoices = invoices.filter(inv => {
      const d = inv.date || inv.created_at?.split('T')[0];
      return d >= start_date && d <= end_date;
    });
    filteredExpenses = expenses.filter(exp => {
      const d = exp.date || exp.created_at?.split('T')[0];
      return d >= start_date && d <= end_date;
    });
  } else if (period === 'all' || period === 'overall') {
    days = 9999;
    periodLabel = 'All Time / Overall';
    filteredInvoices = invoices;
    filteredExpenses = expenses;
  } else {
    const rawDays = customDays ? parseInt(customDays, 10) : parseInt(String(period).replace('d', ''), 10);
    days = !isNaN(rawDays) && rawDays > 0 ? rawDays : 30;
    periodLabel = `Past ${days} Days`;
    const periodCutoff = new Date(now);
    periodCutoff.setDate(now.getDate() - (days - 1));
    const periodCutoffStr = periodCutoff.toISOString().split('T')[0];
    windowStart = periodCutoffStr;
    windowEnd = toKey(now);
    comparable = true;
    filteredInvoices = invoices.filter(inv => (inv.date || inv.created_at?.split('T')[0]) >= periodCutoffStr);
    filteredExpenses = expenses.filter(exp => (exp.date || exp.created_at?.split('T')[0]) >= periodCutoffStr);
  }

  // Cost of the sold items in a set of invoices — shared by the current and the
  // preceding window so both sides are measured the same way.
  const costOf = (invoiceList) => {
    let total = 0;
    invoiceList.forEach(inv => {
      (inv.items || []).forEach(it => {
        total += Number(it.cost_price || 0) * Number(it.quantity || 1);
      });
    });
    return total;
  };

  /**
   * Same-length window immediately before the current one. Returns null when
   * there is no meaningful predecessor (all-time, or no window recorded) so the
   * caller can show "no comparison" rather than a fabricated percentage.
   */
  const previousWindow = () => {
    if (!comparable || !windowStart || !windowEnd) return null;
    const start = new Date(`${windowStart}T00:00:00Z`);
    const end = new Date(`${windowEnd}T00:00:00Z`);
    const spanDays = Math.max(Math.round((end - start) / 86400000) + 1, 1);
    const prevEnd = new Date(start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - (spanDays - 1) * 86400000);
    const prevStartKey = toKey(prevStart);
    const prevEndKey = toKey(prevEnd);
    const inWindow = (row) => {
      const d = row.date || row.created_at?.split('T')[0];
      return d >= prevStartKey && d <= prevEndKey;
    };
    const prevInvoices = invoices.filter(inWindow);
    const prevExpenses = expenses.filter(inWindow);
    return {
      start: prevStartKey,
      end: prevEndKey,
      invoices: prevInvoices.length,
      revenue: prevInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0),
      expense: prevExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0),
      profit:
        prevInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) -
        costOf(prevInvoices) -
        prevExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0)
    };
  };

  const periodRevenue = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  const periodExpense = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

  // Accurate Cost of Goods Sold (Procurement cost of sold items)
  const periodCost = costOf(filteredInvoices);
  const periodGrossProfit = periodRevenue - periodCost;
  // Net profit strictly calculated as Selling Price - Cost Price (Product Margin)
  const periodNetProfit = periodGrossProfit;

  const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  const totalExpense = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const totalCost = costOf(invoices);
  const totalGrossProfit = totalRevenue - totalCost;
  const netProfit = totalGrossProfit;

  // Percentage change against the preceding window. Null when there is no
  // predecessor, or when the predecessor held nothing to compare against — a
  // division by zero is not a 100% increase.
  const changePct = (current, previous) => {
    if (previous === null || previous === undefined) return null;
    if (!Number.isFinite(previous) || previous === 0) return null;
    return round2(((current - previous) / Math.abs(previous)) * 100);
  };

  const prev = previousWindow();

  const lowStockCount = products.filter(
    p => p.min_stock_level != null && Number(p.stock_quantity || 0) <= Number(p.min_stock_level)
  ).length;

  res.json({
    kpis: {
      period_days: days,
      period_label: periodLabel,
      period_window_start: windowStart,
      period_window_end: windowEnd,
      period_revenue: round2(periodRevenue),
      period_cogs: round2(periodCost),
      period_gross_profit: round2(periodGrossProfit),
      period_expense: round2(periodExpense),
      period_profit: round2(periodNetProfit),
      period_net_profit: round2(periodNetProfit),
      period_profit_margin: round2((periodNetProfit / (periodRevenue + 1e-5)) * 100),
      period_gross_margin: round2((periodGrossProfit / (periodRevenue + 1e-5)) * 100),
      period_invoices: filteredInvoices.length,
      // Period-over-period, measured against the immediately preceding window of
      // equal length. These replace three hardcoded badges (12.5% / 5.2% /
      // 18.3%) that were displayed as growth on every dashboard load.
      comparison_window_start: prev ? prev.start : null,
      comparison_window_end: prev ? prev.end : null,
      revenue_change_pct: prev ? changePct(periodRevenue, prev.revenue) : null,
      expense_change_pct: prev ? changePct(periodExpense, prev.expense) : null,
      profit_change_pct: prev ? changePct(periodNetProfit, prev.profit) : null,
      previous_period_revenue: prev ? round2(prev.revenue) : null,
      previous_period_expense: prev ? round2(prev.expense) : null,
      previous_period_profit: prev ? round2(prev.profit) : null,
      total_revenue: round2(totalRevenue),
      total_cogs: round2(totalCost),
      total_gross_profit: round2(totalGrossProfit),
      total_expense: round2(totalExpense),
      net_profit: round2(netProfit),
      total_invoices: invoices.length,
      total_customers: customers.length,
      low_stock_alerts: lowStockCount
    }
  });
};

exports.getSalesTimeSeries = (req, res) => {
  const storeId = getStoreId(req);
  const { period = '30', days: customDays, start_date, end_date } = req.query;
  
  const invoices = db.table('invoices').find(i => i.store_id === storeId);
  const expenses = db.table('expenses').find(e => e.store_id === storeId);

  const timeline = [];

  if (start_date && end_date) {
    let curr = new Date(start_date);
    const end = new Date(end_date);
    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      const dayInvoices = invoices.filter(inv => (inv.date || inv.created_at?.split('T')[0]) === dateStr);
      const dayExpenses = expenses.filter(exp => (exp.date || exp.created_at?.split('T')[0]) === dateStr);

      let dayCost = 0;
      dayInvoices.forEach(inv => {
        (inv.items || []).forEach(it => {
          dayCost += Number(it.cost_price || 0) * Number(it.quantity || 1);
        });
      });

      const revenue = dayInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
      const expense = dayExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
      const grossProfit = revenue - dayCost;
      const netProfit = grossProfit;

      timeline.push({
        date: dateStr,
        revenue: round2(revenue),
        cogs: round2(dayCost),
        gross_profit: round2(grossProfit),
        expense: round2(expense),
        profit: round2(netProfit),
        net_profit: round2(netProfit),
        orders: dayInvoices.length
      });

      curr.setDate(curr.getDate() + 1);
    }
  } else {
    const rawDays = customDays ? parseInt(customDays, 10) : parseInt(String(period).replace('d', ''), 10);
    const days = (period === 'all' || period === 'overall') ? 30 : (!isNaN(rawDays) && rawDays > 0 ? Math.min(rawDays, 90) : 30);
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const dayInvoices = invoices.filter(inv => (inv.date || inv.created_at?.split('T')[0]) === dateStr);
      const dayExpenses = expenses.filter(exp => (exp.date || exp.created_at?.split('T')[0]) === dateStr);

      let dayCost = 0;
      dayInvoices.forEach(inv => {
        (inv.items || []).forEach(it => {
          dayCost += Number(it.cost_price || 0) * Number(it.quantity || 1);
        });
      });

      const revenue = dayInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
      const expense = dayExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
      const grossProfit = revenue - dayCost;
      const netProfit = grossProfit;

      timeline.push({
        date: dateStr,
        revenue: round2(revenue),
        cogs: round2(dayCost),
        gross_profit: round2(grossProfit),
        expense: round2(expense),
        profit: round2(netProfit),
        net_profit: round2(netProfit),
        orders: dayInvoices.length
      });
    }
  }

  res.json({ timeline });
};

exports.getTopProducts = (req, res) => {
  const storeId = getStoreId(req);
  const { period = '30', days: customDays, start_date, end_date } = req.query;
  let invoices = db.table('invoices').find(i => i.store_id === storeId);
  const products = db.table('products').find(p => p.store_id === storeId);
  const prodImageMap = {};
  products.forEach(p => { prodImageMap[p.id] = p.image_url; });

  if (start_date && end_date) {
    invoices = invoices.filter(inv => {
      const d = inv.date || inv.created_at?.split('T')[0];
      return d >= start_date && d <= end_date;
    });
  } else if (period !== 'all' && period !== 'overall') {
    const rawDays = customDays ? parseInt(customDays, 10) : parseInt(String(period).replace('d', ''), 10);
    const numDays = !isNaN(rawDays) && rawDays > 0 ? rawDays : 30;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - (numDays - 1));
    const cutoffStr = cutoff.toISOString().split('T')[0];
    invoices = invoices.filter(inv => (inv.date || inv.created_at?.split('T')[0]) >= cutoffStr);
  }

  const productSalesMap = {};

  invoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const pid = item.product_id;
      if (!productSalesMap[pid]) {
        productSalesMap[pid] = {
          product_id: pid,
          product_name: item.product_name,
          category_name: item.category_name || 'General',
          image_url: item.image_url || prodImageMap[pid] || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100&auto=format&fit=crop&q=80',
          total_units: 0,
          total_revenue: 0
        };
      }
      productSalesMap[pid].total_units += Number(item.quantity || 1);
      productSalesMap[pid].total_revenue += Number(item.total_amount || (Number(item.quantity || 1) * Number(item.unit_price || 0)));
    });
  });

  const topProducts = Object.values(productSalesMap)
    .map(p => ({ ...p, total_revenue: round2(p.total_revenue) }))
    .sort((a, b) => b.total_revenue - a.total_revenue);

  res.json({ topProducts: topProducts.slice(0, 10) });
};

exports.getCategoryBreakdown = (req, res) => {
  const storeId = getStoreId(req);
  const { period = '30', days: customDays, start_date, end_date } = req.query;
  let invoices = db.table('invoices').find(i => i.store_id === storeId);

  if (start_date && end_date) {
    invoices = invoices.filter(inv => {
      const d = inv.date || inv.created_at?.split('T')[0];
      return d >= start_date && d <= end_date;
    });
  } else if (period !== 'all' && period !== 'overall') {
    const rawDays = customDays ? parseInt(customDays, 10) : parseInt(String(period).replace('d', ''), 10);
    const numDays = !isNaN(rawDays) && rawDays > 0 ? rawDays : 30;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - (numDays - 1));
    const cutoffStr = cutoff.toISOString().split('T')[0];
    invoices = invoices.filter(inv => (inv.date || inv.created_at?.split('T')[0]) >= cutoffStr);
  }

  const catMap = {};
  let totalRev = 0;

  invoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const cat = item.category_name || 'General';
      const amt = Number(item.total_amount || (Number(item.quantity || 1) * Number(item.unit_price || 0)));
      catMap[cat] = (catMap[cat] || 0) + amt;
      totalRev += amt;
    });
  });

  const breakdown = Object.keys(catMap).map(cat => ({
    category: cat,
    revenue: round2(catMap[cat]),
    share_pct: round2((catMap[cat] / (totalRev + 1e-5)) * 100)
  })).sort((a, b) => b.revenue - a.revenue);

  res.json({ category_breakdown: breakdown, total_revenue: round2(totalRev) });
};
