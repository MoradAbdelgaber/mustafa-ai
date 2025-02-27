// routes/attendReportRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const ctrl = require('../controllers/attendReportController');


// تعريف باقي المسارات الديناميكية
router.post('/', authMiddleware, ctrl.createReport);
router.get('/', authMiddleware, ctrl.getAllReports);
router.get('/:id', authMiddleware, ctrl.getReportById);
router.put('/:id', authMiddleware, ctrl.updateReport);
router.delete('/:id', authMiddleware, ctrl.deleteReport);

module.exports = router;
