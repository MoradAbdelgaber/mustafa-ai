const express = require("express");
const router = express.Router();
const controller = require("../controllers/shiftController");
const { authMiddleware } = require('../auth');

router.post("/", authMiddleware, controller.createShift);
router.get("/", authMiddleware, controller.getAllShifts);
router.get("/:id", authMiddleware, controller.getShiftById);
router.put("/:id", authMiddleware, controller.updateShift);
router.delete("/:id", authMiddleware, controller.deleteShift);

module.exports = router;
