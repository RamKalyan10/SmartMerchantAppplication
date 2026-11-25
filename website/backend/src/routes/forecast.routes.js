const express = require('express');
const router = express.Router();
const forecastController = require('../controllers/forecastController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(requireRole('Admin'));

router.get('/sales', forecastController.getSalesForecast);
router.get('/demand', forecastController.getDemandForecast);
router.get('/catalog', forecastController.getCatalogClassifications);
router.get('/expenses', forecastController.getExpenseForecastAndAnomalies);
router.get('/insights', forecastController.getExecutiveInsights);

module.exports = router;
