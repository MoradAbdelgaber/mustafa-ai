// controllers/WeekScheduleTemplateController.js
const Employee = require("../models/Employee");
const WeekScheduleTemplate = require("../models/WeekScheduleTemplate");

exports.createWeekScheduleTemplate = async (req, res) => {
  try {
    const templateData = {
      ...req.body,
      owner: req.userId,
    };

    const saved = await WeekScheduleTemplate.create(templateData);
    return res.status(201).json(saved);
  } catch (error) {
    console.error(error);
    return res
      .status(400)
      .json({ error: "Error creating WeekScheduleTemplate" });
  }
};

exports.getAllWeekScheduleTemplates = async (req, res) => {
  try {
    // رشّح بالمالك
    const data = await WeekScheduleTemplate.find({ owner: req.userId });
    return res.json(data);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Error fetching WeekScheduleTemplates" });
  }
};

exports.getWeekScheduleTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    // ابحث عن نوع إجازة يخص هذا المستخدم
    const vt = await WeekScheduleTemplate.findOne({
      _id: id,
      owner: req.userId,
    });
    if (!vt) {
      return res.status(404).json({
        message: "WeekScheduleTemplate not found or not owned by you",
      });
    }
    return res.json(vt);
  } catch (error) {
    return res
      .status(400)
      .json({ error: "Error fetching WeekScheduleTemplate" });
  }
};

exports.applyTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    // ابحث عن نوع إجازة يخص هذا المستخدم
    const vt = await WeekScheduleTemplate.findOne({
      _id: id,
      owner: req.userId,
    });
    if (!vt) {
      return res.status(404).json({
        message: "WeekScheduleTemplate not found or not owned by you",
      });
    }

    const updated = await Employee.updateMany(
      { weekSchedulesId: vt._id },
      { weekSchedules: vt.weekSchedules }
    );

    return res.json(updated);
  } catch (error) {
    return res
      .status(400)
      .json({ error: "Error fetching WeekScheduleTemplate" });
  }
};

exports.updateWeekScheduleTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    // تحديث نوع إجازة ينتمي للمستخدم
    const updated = await WeekScheduleTemplate.findOneAndUpdate(
      { _id: id, owner: req.userId },
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({
        message: "WeekScheduleTemplate not found or not owned by you",
      });
    }
    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res
      .status(400)
      .json({ error: "Error updating WeekScheduleTemplate" });
  }
};

exports.deleteWeekScheduleTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    // حذف نوع إجازة يخص نفس المستخدم
    const deleted = await WeekScheduleTemplate.findOneAndDelete({
      _id: id,
      owner: req.userId,
    });
    if (!deleted) {
      return res.status(404).json({
        message: "WeekScheduleTemplate not found or not owned by you",
      });
    }
    return res.json({ message: "WeekScheduleTemplate deleted successfully" });
  } catch (error) {
    console.error(error);
    return res
      .status(400)
      .json({ error: "Error deleting WeekScheduleTemplate" });
  }
};
