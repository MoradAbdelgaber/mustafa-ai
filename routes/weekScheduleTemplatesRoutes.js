// routes/WeekScheduleTemplateRoutes.js
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../auth");
const ctrl = require("../controllers/weekScheduleTemplateController");

router.post("/", authMiddleware, ctrl.createWeekScheduleTemplate);
router.get("/", authMiddleware, ctrl.getAllWeekScheduleTemplates);
router.get("/:id", authMiddleware, ctrl.getWeekScheduleTemplateById);
router.put("/:id", authMiddleware, ctrl.updateWeekScheduleTemplate);
router.delete("/:id", authMiddleware, ctrl.deleteWeekScheduleTemplate);

module.exports = router;
