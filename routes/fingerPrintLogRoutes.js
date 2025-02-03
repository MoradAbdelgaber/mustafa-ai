// routes/fingerPrintLogRoutes.js
const express = require("express");
const router = express.Router();
const { authMiddleware, authEmployeeMiddleware } = require("../auth");
const ctrl = require("../controllers/fingerPrintLogController");

router.post("/", authMiddleware, ctrl.createLog);
router.post("/socket", ctrl.createLogFromSocket);
router.post("/app", authEmployeeMiddleware, ctrl.createLogFromApp);
router.get("/", authMiddleware, ctrl.getLogs);
router.get("/:id", authMiddleware, ctrl.getLogById);
router.put("/:id", authMiddleware, ctrl.updateLog);
router.delete("/:id", authMiddleware, ctrl.deleteLog);

module.exports = router;
