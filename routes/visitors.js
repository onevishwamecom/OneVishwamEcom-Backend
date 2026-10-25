const express = require('express');
const {
  recordHit,
  recordPing,
  recordLeave,
  getVisitorCount,
} = require('../controllers/visitorController');

const router = express.Router();

// Record a visit / page hit (with 24h deduplication per device/session)
router.post('/hit', recordHit);
router.get('/hit', recordHit);

// Heartbeat ping while user has website open
router.post('/ping', recordPing);

// Graceful leave beacon fired when user closes tab/browser
router.post('/leave', recordLeave);

// Get current visitor counts
router.get('/count', getVisitorCount);

module.exports = router;
