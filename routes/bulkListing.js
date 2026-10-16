const express = require('express');
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');
const {
  bulkUploadListings,
  recordTemplateDownloadLog,
  getTemplateDownloadLogs,
  getBulkBatches,
  getBulkBatchById,
  addItemToBatch,
  updateBatchItem,
  deleteBatchItem,
  deleteBatch,
} = require('../controllers/bulkListingController');

const router = express.Router();

// Download log recording (Listers download template)
router.post('/download-log', optionalAuth, recordTemplateDownloadLog);

// Audit download logs (Admin view)
router.get('/download-logs', protect, adminOnly, getTemplateDownloadLogs);

// Bulk Upload Batches (Listers see own, Admin sees all)
router.get('/batches', protect, getBulkBatches);
router.get('/batches/:batchId', protect, getBulkBatchById);

// Batch item CRUD operations
router.post('/batches/:batchId/items', protect, addItemToBatch);
router.put('/batches/:batchId/items/:itemId', protect, updateBatchItem);
router.delete('/batches/:batchId/items/:itemId', protect, deleteBatchItem);

// Batch delete
router.delete('/batches/:batchId', protect, deleteBatch);

// Direct bulk upload endpoint
router.post('/upload', protect, bulkUploadListings);

module.exports = router;
