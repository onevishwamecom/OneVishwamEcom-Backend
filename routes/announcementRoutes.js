const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const {
  getPublicAnnouncements,
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  toggleAnnouncement,
  deleteAnnouncement,
  simulateProductAddition,
} = require('../controllers/announcementController');

const router = express.Router();

// Public endpoint for the website ribbon
router.get('/', getPublicAnnouncements);

// Protected admin management endpoints
router.get('/admin', protect, adminOnly, getAllAnnouncements);
router.post('/admin', protect, adminOnly, createAnnouncement);
router.post('/admin/simulate-addition', protect, adminOnly, simulateProductAddition);
router.put('/admin/:id', protect, adminOnly, updateAnnouncement);
router.patch('/admin/:id/toggle', protect, adminOnly, toggleAnnouncement);
router.delete('/admin/:id', protect, adminOnly, deleteAnnouncement);

module.exports = router;

