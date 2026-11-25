const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/status', inventoryController.getInventoryStatus);
router.post('/adjust', requireRole('Manager'), inventoryController.adjustStock);
router.get('/transactions', inventoryController.getTransactions);

// Purchase orders — placing and receiving both move stock, so they carry the
// same Manager guard as /adjust. Reads are open to any authenticated user.
router.get('/purchase-orders', inventoryController.getPurchaseOrders);
router.post('/purchase-orders', requireRole('Manager'), inventoryController.createPurchaseOrder);
router.post('/purchase-orders/:id/receive', requireRole('Manager'), inventoryController.receivePurchaseOrder);

module.exports = router;
