// routes/reportRoutes.js

const express = require("express");
const router = express.Router();
const { authMiddleware, authEmployeeMiddleware } = require("../auth");
const { getFullAttendanceReport } = require("../controllers/reportController1");
const { getDashboardMetrics } = require("../controllers/reportController1");
const { checkEmployeeStatus } = require("../controllers/reportController1");
const {
  getCustomTimeAttendanceReport,
} = require("../controllers/suddenlycheck");

// مسار واحد للتقرير
router.get("/attendance", authMiddleware, getFullAttendanceReport);

//بصمة مفاجأة
router.get(
  "/getCustomTimeAttendanceReport",
  authMiddleware,
  getCustomTimeAttendanceReport
);

// تجييك موظف
router.post("/checkEmployeeStatus", authMiddleware, checkEmployeeStatus);

router.get("/dashboard-metrics", authMiddleware, getDashboardMetrics);

//employee get his logs
router.get(
  "/attendance/employee",
  authEmployeeMiddleware,
  getFullAttendanceReport
);

module.exports = router;
