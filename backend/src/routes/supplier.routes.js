const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/', supplierController.getSuppliers);
router.get('/:id', supplierController.getSupplierById);
router.post('/', requireRole('Admin'), supplierController.createSupplier);
router.put('/:id', requireRole('Admin'), supplierController.updateSupplier);
router.delete('/:id', requireRole('Admin'), supplierController.deleteSupplier);

module.exports = router;
