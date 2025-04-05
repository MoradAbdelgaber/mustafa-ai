const ExtraMinutes = require('../models/ExtraMinutes');

exports.createExtraMinutes = async (req, res) => {
  try {
    // يتم ربط السجل بالمستخدم الحالي عن طريق إضافة owner=req.userId
    const extraData = {
      ...req.body,
      owner: req.userId
    };
    const record = await ExtraMinutes.create(extraData);
    return res.status(201).json(record);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error creating extra minutes record' });
  }
};

exports.getAllExtraMinutes = async (req, res) => {
  try {
    // جلب السجلات الخاصة بالمستخدم
    const records = await ExtraMinutes.find({ owner: req.userId });
    return res.json(records);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error fetching extra minutes records' });
  }
};

exports.getExtraMinutesById = async (req, res) => {
  try {
    const { id } = req.params;
    // البحث عن السجل الخاص بالمستخدم
    const record = await ExtraMinutes.findOne({ _id: id, owner: req.userId });
    if (!record) {
      return res.status(404).json({ message: 'Record not found or not owned by you' });
    }
    return res.json(record);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error fetching extra minutes record' });
  }
};

exports.updateExtraMinutes = async (req, res) => {
  try {
    const { id } = req.params;
    // تحديث السجل بعد التحقق من الملكية
    const updatedRecord = await ExtraMinutes.findOneAndUpdate(
      { _id: id, owner: req.userId },
      req.body,
      { new: true }
    );
    if (!updatedRecord) {
      return res.status(404).json({ message: 'Record not found or not owned by you' });
    }
    return res.json(updatedRecord);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error updating extra minutes record' });
  }
};

exports.deleteExtraMinutes = async (req, res) => {
  try {
    const { id } = req.params;
    // حذف السجل بعد التحقق من الملكية
    const deletedRecord = await ExtraMinutes.findOneAndDelete({ _id: id, owner: req.userId });
    if (!deletedRecord) {
      return res.status(404).json({ message: 'Record not found or not owned by you' });
    }
    return res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error deleting extra minutes record' });
  }
};
