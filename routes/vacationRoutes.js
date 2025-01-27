// routes/vacationRoutes.js
const express = require('express');
const router = express.Router();
const vacationController = require('../controllers/vacationController');

// إنشاء إجازة جديدة
router.post('/', vacationController.createVacation);

// جلب جميع الإجازات (مع فلترة التاريخ إن لزم)
router.get('/', vacationController.getAllVacations);

// جلب إجازة واحدة بالمعرّف
router.get('/:id', vacationController.getVacationById);

// تحديث إجازة بالمعرّف
router.put('/:id', vacationController.updateVacation);

// حذف إجازة بالمعرّف
router.delete('/:id', vacationController.deleteVacation);

module.exports = router;
