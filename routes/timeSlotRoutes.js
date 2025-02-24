const express = require("express");
const router = express.Router();
const controller = require("../controllers/timeSlotController");
const { authMiddleware } = require('../auth');

router.post("/", authMiddleware, controller.createTimeSlot);
router.get("/", authMiddleware, controller.getAllTimeSlots);
router.get("/:id", authMiddleware, controller.getTimeSlotById); // جلب سلوت محدد بواسطة الـ id
router.put("/:id", authMiddleware, controller.updateTimeSlot);
router.delete("/:id", authMiddleware, controller.deleteTimeSlot);

module.exports = router;
