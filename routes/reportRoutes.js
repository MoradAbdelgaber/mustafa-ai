// routes/reportRoutes.js

const express = require("express");
const router = express.Router();
const { authMiddleware, authEmployeeMiddleware } = require("../auth");
const { getFullAttendanceReport } = require("../controllers/reportController");

// مسار واحد للتقرير
router.get("/attendance", authMiddleware, getFullAttendanceReport);

//employee get his logs
router.get(
  "/attendance/employee",
  authEmployeeMiddleware,
  getFullAttendanceReport
);

module.exports = router;
