const db = require('../config/db');

const getStoreId = (req) => req.storeId || req.user?.store_id || 'store_dwdm_001';

exports.getExpenses = (req, res) => {
  const storeId = getStoreId(req);
  const { category, start_date, end_date, period = 'all', days: customDays } = req.query;
  const allStoreExpenses = db.table('expenses').find(e => e.store_id === storeId);
  let expenses = [...allStoreExpenses];

  let periodLabel = 'Overall / All Time';
  let periodDays = 9999;

  // Handle custom date range vs preset / days
  if (start_date && end_date) {
    periodLabel = `${start_date} to ${end_date}`;
    const diffMs = Math.abs(new Date(end_date) - new Date(start_date));
    periodDays = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1, 1);
    expenses = expenses.filter(e => {
      const d = e.date || e.created_at?.split('T')[0];
      return d >= start_date && d <= end_date;
    });
  } else if (period === 'all' || period === 'overall') {
    periodDays = 9999;
    periodLabel = 'Overall / All Time';
  } else {
    const rawDays = customDays ? parseInt(customDays, 10) : parseInt(String(period).replace('d', ''), 10);
    const numDays = !isNaN(rawDays) && rawDays > 0 ? rawDays : 30;
    periodDays = numDays;
    periodLabel = `Past ${numDays} Days`;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - (numDays - 1));
    const cutoffStr = cutoff.toISOString().split('T')[0];
    expenses = expenses.filter(e => (e.date || e.created_at?.split('T')[0]) >= cutoffStr);
  }

  if (category && category !== 'All') {
    expenses = expenses.filter(e => e.category === category);
  }
  if (start_date) {
    expenses = expenses.filter(e => (e.date || e.created_at?.split('T')[0]) >= start_date);
  }
  if (end_date) {
    expenses = expenses.filter(e => (e.date || e.created_at?.split('T')[0]) <= end_date);
  }

  expenses.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));

  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const allTimeTotal = allStoreExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const dailyAverage = periodDays < 9999 ? Math.round((totalExpense / periodDays) * 100) / 100 : Math.round((totalExpense / 120) * 100) / 100;

  // Aggregate category breakdown for selected period
  const categoryMap = {};
  expenses.forEach(e => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount || 0);
  });

  const categoryBreakdown = Object.keys(categoryMap).map(k => ({
    category: k,
    total: categoryMap[k],
    share_pct: Math.round((categoryMap[k] / (totalExpense + 1e-5)) * 1000) / 10
  })).sort((a, b) => b.total - a.total);

  res.json({
    expenses,
    total_expense: totalExpense,
    all_time_total: allTimeTotal,
    daily_average: dailyAverage,
    period: period,
    period_days: periodDays,
    period_label: periodLabel,
    category_breakdown: categoryBreakdown,
    total_count: expenses.length
  });
};

exports.createExpense = (req, res) => {
  const storeId = getStoreId(req);
  const { category, amount, description, date } = req.body;
  const newExp = db.table('expenses').insert({
    store_id: storeId,
    category: category || 'General',
    amount: Number(amount) || 0,
    description: description || '',
    date: date || new Date().toISOString().split('T')[0],
    created_by: req.user ? req.user.name : 'Merchant Admin'
  });

  res.status(201).json({ expense: newExp, message: 'Expense recorded successfully' });
};

exports.deleteExpense = (req, res) => {
  const storeId = getStoreId(req);
  const existing = db.table('expenses').findOne(e => e.id === req.params.id && e.store_id === storeId);
  if (!existing) return res.status(404).json({ message: 'Expense not found' });

  db.table('expenses').delete(req.params.id);
  res.json({ message: 'Expense deleted successfully' });
};
