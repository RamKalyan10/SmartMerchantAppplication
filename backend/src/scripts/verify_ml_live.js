const axios = require('axios');

async function testAllForecasting() {
  console.log('========================================================');
  console.log('🧪 Verifying All ML Forecasting Endpoints (Live Models)');
  console.log('========================================================');

  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'onr1@gmail.com',
      password: 'password123'
    });
    const token = loginRes.data.token;
    const headers = { Authorization: 'Bearer ' + token };

    const endpoints = [
      { name: 'Sales Forecast (14 Days)', url: '/forecast/sales?days=14' },
      { name: 'Sales Forecast (30 Days)', url: '/forecast/sales?days=30' },
      { name: 'Demand Forecast (14 Days)', url: '/forecast/demand?days=14&min_stock_floor=15&sensitivity=balanced' },
      { name: 'Demand Forecast (30 Days)', url: '/forecast/demand?days=30&min_stock_floor=15&sensitivity=balanced' },
      { name: 'Catalog Classification', url: '/forecast/catalog' },
      { name: 'Expense Forecast (14 Days)', url: '/forecast/expenses?days=14&min_stock_floor=15&sensitivity=balanced' },
      { name: 'Expense Forecast (30 Days)', url: '/forecast/expenses?days=30&min_stock_floor=15&sensitivity=balanced' },
      { name: 'Executive Insights (14 Days)', url: '/forecast/insights?days=14&min_stock_floor=15&sensitivity=balanced' },
      { name: 'Executive Insights (30 Days)', url: '/forecast/insights?days=30&min_stock_floor=15&sensitivity=balanced' }
    ];

    let allLive = true;

    for (const ep of endpoints) {
      const t0 = Date.now();
      try {
        const res = await axios.get('http://localhost:5000/api' + ep.url, { headers, timeout: 60000 });
        const dt = Date.now() - t0;
        const isDegraded = res.data.degraded === true;
        const method = res.data.method || res.data.model_info?.method || 'trained';

        if (isDegraded) {
          allLive = false;
          console.log(`❌ [FALLBACK/DEGRADED] ${ep.name} (${dt}ms) -> ${res.data.degraded_reason || 'Fallback'}`);
        } else {
          console.log(`✅ [LIVE MODEL] ${ep.name} (${dt}ms) -> method: ${method}`);
        }
      } catch (err) {
        allLive = false;
        console.error(`❌ [ERROR] ${ep.name}:`, err.message);
      }
    }

    console.log('========================================================');
    if (allLive) {
      console.log('🎉 SUCCESS: All ML models are live, responding quickly, and no fallback warnings active!');
    } else {
      console.log('⚠️ WARNING: Some endpoints returned fallbacks.');
    }
    console.log('========================================================');
  } catch (err) {
    console.error('Login or setup error:', err.message);
  }
}

testAllForecasting();
