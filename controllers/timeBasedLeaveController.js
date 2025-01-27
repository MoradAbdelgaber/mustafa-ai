// controllers/timeBasedLeaveController.js
const TimeBasedLeave = require('../models/TimeBasedLeave');

exports.createLeave = async (req, res) => {
  try {
    // أضف حقل owner: req.userId
    const leaveData = {
      ...req.body,
      owner: req.userId
    };

    const leave = await TimeBasedLeave.create(leaveData);
    return res.status(201).json(leave);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error creating leave' });
  }
};

exports.getAllLeaves = async (req, res) => {
  try {
    // نرشّح بالمالك
    const leaves = await TimeBasedLeave.find({ owner: req.userId });
    return res.json(leaves);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error fetching leaves' });
  }
};

exports.getLeaveById = async (req, res) => {
  try {
    const { id } = req.params;
    // ابحث عن سجل ينتمي للمستخدم الحالي
    const leave = await TimeBasedLeave.findOne({ _id: id, owner: req.userId });
    if (!leave) {
      return res.status(404).json({ message: 'Leave not found or not owned by you' });
    }
    return res.json(leave);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error fetching leave' });
  }
};

exports.updateLeave = async (req, res) => {
  try {
    const { id } = req.params;
    // تحديث سجل يخص المالك نفسه
    const updatedLeave = await TimeBasedLeave.findOneAndUpdate(
      { _id: id, owner: req.userId },
      req.body,
      { new: true }
    );
    if (!updatedLeave) {
      return res.status(404).json({ message: 'Leave not found or not owned by you' });
    }
    return res.json(updatedLeave);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error updating leave' });
  }
};

exports.deleteLeave = async (req, res) => {
  try {
    const { id } = req.params;
    // حذف سجل يخص المالك
    const deletedLeave = await TimeBasedLeave.findOneAndDelete({ _id: id, owner: req.userId });
    if (!deletedLeave) {
      return res.status(404).json({ message: 'Leave not found or not owned by you' });
    }
    return res.json({ message: 'Leave deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error deleting leave' });
  }
};
