// controllers/vacationTypeController.js
const VacationType = require('../models/VacationType');

exports.createVacationType = async (req, res) => {
  try {
    // ضف owner: req.userId
    const vtData = {
      ...req.body,
      owner: req.userId
    };

    const vt = await VacationType.create(vtData);
    return res.status(201).json(vt);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error creating vacation type' });
  }
};

exports.getAllVacationTypes = async (req, res) => {
  try {
    // رشّح بالمالك
    const data = await VacationType.find({ owner: req.userId });
    return res.json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error fetching vacation types' });
  }
};

exports.getVacationTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    // ابحث عن نوع إجازة يخص هذا المستخدم
    const vt = await VacationType.findOne({ _id: id, owner: req.userId });
    if (!vt) {
      return res.status(404).json({ message: 'Vacation type not found or not owned by you' });
    }
    return res.json(vt);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error fetching vacation type' });
  }
};

exports.updateVacationType = async (req, res) => {
  try {
    const { id } = req.params;
    // تحديث نوع إجازة ينتمي للمستخدم
    const updated = await VacationType.findOneAndUpdate(
      { _id: id, owner: req.userId },
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: 'Vacation type not found or not owned by you' });
    }
    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error updating vacation type' });
  }
};

exports.deleteVacationType = async (req, res) => {
  try {
    const { id } = req.params;
    // حذف نوع إجازة يخص نفس المستخدم
    const deleted = await VacationType.findOneAndDelete({ _id: id, owner: req.userId });
    if (!deleted) {
      return res.status(404).json({ message: 'Vacation type not found or not owned by you' });
    }
    return res.json({ message: 'Vacation type deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error deleting vacation type' });
  }
};
