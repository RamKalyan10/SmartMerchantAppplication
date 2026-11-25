const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);
router.get('/:id/payments', customerController.getCustomerPayments);
router.post('/', customerController.createCustomer);
router.post('/:id/installment', customerController.recordInstallmentPayment);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
