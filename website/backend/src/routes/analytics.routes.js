const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(requireRole('Admin'));

router.get('/overview', analyticsController.getExecutiveOverview);
router.get('/sales-timeline', analyticsController.getSalesTimeSeries);
router.get('/top-products', analyticsController.getTopProducts);
router.get('/categories', analyticsController.getCategoryBreakdown);

module.exports = router;
