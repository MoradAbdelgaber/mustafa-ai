// routes/apiRequestRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const ctrl = require('../controllers/apiRequestController');

router.post('/', authMiddleware, ctrl.createRequest);
router.post('/resend', authMiddleware, ctrl.bulkUpdateRequests);
router.get('/', authMiddleware, ctrl.getAllRequests);
router.get('/:id', authMiddleware, ctrl.getRequestById);
router.put('/:id', authMiddleware, ctrl.updateRequest);
router.delete('/:id', authMiddleware, ctrl.deleteRequest);

module.exports = router;
