const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(requireRole('Manager'));

router.get('/', expenseController.getExpenses);
router.post('/', expenseController.createExpense);
router.delete('/:id', requireRole('Admin'), expenseController.deleteExpense);

module.exports = router;
