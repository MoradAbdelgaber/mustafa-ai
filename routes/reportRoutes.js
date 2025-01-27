// routes/reportRoutes.js

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const { getFullAttendanceReport } = require('../controllers/reportController');

// مسار واحد للتقرير
router.get('/attendance', authMiddleware, getFullAttendanceReport);

module.exports = router;
