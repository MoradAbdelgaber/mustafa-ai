// routes/fingerPrintLogRoutes.js
const express = require("express");
const router = express.Router();
const { authMiddleware, authEmployeeMiddleware } = require("../auth");
const ctrl = require("../controllers/fingerPrintLogController");

//admin create log
router.post("/", authMiddleware, ctrl.createLog);
//device create log
router.post("/socket", ctrl.createLogFromSocket);
//employee create log
router.post("/app", authEmployeeMiddleware, ctrl.createLogFromApp);
// الراوت الجديد لنقل/تعديل سجلات البصمات
router.post("/transfer", authMiddleware, ctrl.modifyFingerprints);

//بلك دليت للاكثر من بصمة
router.post("/bulk-delete", authMiddleware, ctrl.bulkDelete);

//admin get all logs
router.get("/", authMiddleware, ctrl.getLogs);
//employee get his logs
router.get("/employee", authEmployeeMiddleware, ctrl.getLogs);
//admin get all logs grouped by day and employee
router.get(
  "/grouped-day-employee",
  authMiddleware,
  ctrl.getLogsGroupedByEmployeeAndDay
);
//admin get log by id
router.get("/:id", authMiddleware, ctrl.getLogById);
//admin update log
router.put("/:id", authMiddleware, ctrl.updateLog);
//admin delete log
router.delete("/:id", authMiddleware, ctrl.deleteLog);

module.exports = router;
