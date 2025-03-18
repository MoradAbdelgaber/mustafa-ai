const express = require("express");
const router = express.Router();
const flexibleAggregateRuleController = require("../controllers/flexibleAggregateRuleController");
const { authMiddleware } = require('../auth');

// إنشاء قاعدة جديدة
router.post("/", authMiddleware, flexibleAggregateRuleController.createRule);

// تعديل قاعدة موجودة باستخدام المعرف (ID)
router.put("/:id", authMiddleware, flexibleAggregateRuleController.updateRule);

// جلب جميع القواعد الخاصة بالمستخدم
router.get("/", authMiddleware, flexibleAggregateRuleController.getAllRules);

// حذف قاعدة موجودة باستخدام المعرف (ID)
router.delete("/:id", authMiddleware, flexibleAggregateRuleController.deleteRule);

module.exports = router;
