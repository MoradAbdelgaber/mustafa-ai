const express = require("express");
const router = express.Router();
const branchController = require("../controllers/branchController");
// ميدلوير للتحقق من المصادقة (مثال)
const { authMiddleware } = require('../auth');

// إنشاء فرع جديد
router.post("/", authMiddleware, branchController.createBranch);

// استرجاع جميع الفروع الخاصة بالمستخدم
router.get("/", authMiddleware, branchController.getAllBranches);

// استرجاع فرع بواسطة المعرف
router.get("/:id", authMiddleware, branchController.getBranchById);

// تحديث فرع
router.put("/:id", authMiddleware, branchController.updateBranch);

// حذف فرع
router.delete("/:id", authMiddleware, branchController.deleteBranch);

module.exports = router;
