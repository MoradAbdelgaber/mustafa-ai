const express = require('express');
const router = express.Router();
const ruleController = require('../controllers/ruleController');
const { authMiddleware } = require('../auth');

// جلب جميع القواعد
router.get('/', authMiddleware, ruleController.getRules);

// جلب قاعدة واحدة بالـ ID
router.get('/:id', authMiddleware, ruleController.getRuleById);

// إضافة قاعدة
router.post('/', authMiddleware, ruleController.createRule);

// تعديل قاعدة
router.put('/:id', authMiddleware, ruleController.updateRule);

// حذف قاعدة
router.delete('/:id', authMiddleware, ruleController.deleteRule);

module.exports = router;
