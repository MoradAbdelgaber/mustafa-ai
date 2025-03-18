const express = require("express");
const router = express.Router();
const tagEmployeeController = require("../controllers/tagEmployeeController");
// ميدلوير للتحقق من المصادقة (مثال)
const { authMiddleware } = require('../auth');

// إنشاء تاك جديد
router.post("/", authMiddleware, tagEmployeeController.createTagEmployee);

// استرجاع جميع التاكات الخاصة بالمستخدم
router.get("/", authMiddleware, tagEmployeeController.getAllTagEmployees);

// استرجاع تاك بواسطة المعرف
router.get("/:id", authMiddleware, tagEmployeeController.getTagEmployeeById);

// تحديث تاك
router.put("/:id", authMiddleware, tagEmployeeController.updateTagEmployee);

// حذف تاك
router.delete("/:id", authMiddleware, tagEmployeeController.deleteTagEmployee);

module.exports = router;
