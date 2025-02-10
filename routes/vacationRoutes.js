// routes/vacationRoutes.js
const express = require("express");
const router = express.Router();
const vacationController = require("../controllers/vacationController");
const { authMiddleware, authEmployeeMiddleware } = require("../auth");

// إنشاء إجازة جديدة
router.post("/", authMiddleware, vacationController.createVacation);

// جلب جميع الإجازات (مع فلترة التاريخ إن لزم)
router.get("/", authMiddleware, vacationController.getAllVacations);

//employee
router
  .route("/employee")
  .post(authEmployeeMiddleware, vacationController.createVacation)
  .get(authEmployeeMiddleware, vacationController.getAllVacations);

// جلب إجازة واحدة بالمعرّف
router.get("/:id", authMiddleware, vacationController.getVacationById);

// تحديث إجازة بالمعرّف
router.put("/:id", authMiddleware, vacationController.updateVacation);

// حذف إجازة بالمعرّف
router.delete("/:id", authMiddleware, vacationController.deleteVacation);

module.exports = router;
