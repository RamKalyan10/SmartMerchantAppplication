const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// --- Specific /categories routes MUST come before /:id wildcard ---
router.get('/categories', productController.getCategories);
router.post('/categories', requireRole('Admin'), productController.createCategory);
router.delete('/categories/:id', requireRole('Admin'), productController.deleteCategory);

// --- Product CRUD (wildcard /:id routes last) ---
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', requireRole('Admin'), productController.createProduct);
router.put('/:id', requireRole('Admin'), productController.updateProduct);
router.delete('/:id', requireRole('Admin'), productController.deleteProduct);

module.exports = router;
