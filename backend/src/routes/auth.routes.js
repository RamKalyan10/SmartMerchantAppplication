const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/me', authMiddleware, authController.getMe);
router.patch('/profile', authMiddleware, authController.updateProfile);
router.get('/capabilities', authController.getCapabilities);
router.get('/staff', authMiddleware, requireRole('Admin'), authController.getStaffList);
router.post('/staff', authMiddleware, requireRole('Admin'), authController.createStaff);
router.delete('/staff/:id', authMiddleware, requireRole('Owner'), authController.deleteStaff);
router.patch('/staff/:id/role', authMiddleware, requireRole('Owner'), authController.updateStaffRole);

module.exports = router;
