const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const ctrl = require('../controllers/extraMinutesController');

// إنشاء سجل
router.post('/', authMiddleware, ctrl.createExtraMinutes);

// جلب كل السجلات
router.get('/', authMiddleware, ctrl.getAllExtraMinutes);

// جلب سجل واحد
router.get('/:id', authMiddleware, ctrl.getExtraMinutesById);

// تحديث سجل
router.put('/:id', authMiddleware, ctrl.updateExtraMinutes);

// حذف سجل
router.delete('/:id', authMiddleware, ctrl.deleteExtraMinutes);

module.exports = router;
