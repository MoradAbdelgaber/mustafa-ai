// controllers/rewardsAndPenaltiesController.js
const RnP = require('../models/RewardsAndPenalties');



exports.createRnP = async (req, res) => {
  try {
    const data = {
      ...req.body,
      owner: req.userId  // تأكد من وجود ميدل وير يضبط req.userId
    };

    const record = await RnP.create(data);
    return res.status(201).json(record);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error creating record' });
  }
};


exports.getAllRnP = async (req, res) => {
  try {
    // سنرشّح كل السجلات بناءً على المالك
    const data = await RnP.find({ owner: req.userId });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching records' });
  }
};


exports.getRnPById = async (req, res) => {
  try {
    const { id } = req.params;

    // ابحث بسجل يخص نفس المالك
    const record = await RnP.findOne({ _id: id, owner: req.userId });
    if (!record) {
      return res.status(404).json({ message: 'Record not found or not owned by you' });
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error fetching record' });
  }
};


exports.updateRnP = async (req, res) => {
  try {
    const { id } = req.params;

    // تحديث بسجل ينتمي لنفس المالك
    const updated = await RnP.findOneAndUpdate(
      { _id: id, owner: req.userId },
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Record not found or not owned by you' });
    }
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error updating record' });
  }
};


exports.deleteRnP = async (req, res) => {
  try {
    const { id } = req.params;

    // حذف بسجل ينتمي لنفس المالك
    const deleted = await RnP.findOneAndDelete({ _id: id, owner: req.userId });
    if (!deleted) {
      return res.status(404).json({ message: 'Record not found or not owned by you' });
    }
    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error deleting record' });
  }
};

