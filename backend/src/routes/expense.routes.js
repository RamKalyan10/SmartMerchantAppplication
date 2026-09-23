const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/', expenseController.getExpenses);
router.post('/', requireRole('Manager'), expenseController.createExpense);
router.delete('/:id', requireRole('Admin'), expenseController.deleteExpense);

module.exports = router;
