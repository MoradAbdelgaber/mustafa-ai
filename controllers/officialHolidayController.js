// controllers/officialHolidayController.js
const OfficialHoliday = require('../models/OfficialHoliday');

exports.createHoliday = async (req, res) => {
  try {
    // أضف المالك
    const holidayData = {
      ...req.body,
      owner: req.userId  // تأكّد من وجود ميدل وير يضع userId
    };

    const holiday = await OfficialHoliday.create(holidayData);
    res.status(201).json(holiday);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error creating holiday' });
  }
};

exports.getAllHolidays = async (req, res) => {
  try {
    // نرشّح بالمالك
    const data = await OfficialHoliday.find({ owner: req.userId });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching holidays' });
  }
};


exports.getHolidayById = async (req, res) => {
  try {
    const { id } = req.params;

    // ابحث بما يخص هذا المستخدم
    const holiday = await OfficialHoliday.findOne({ _id: id, owner: req.userId });
    if (!holiday) {
      return res.status(404).json({ message: 'Holiday not found or not owned by you' });
    }
    res.json(holiday);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error fetching holiday' });
  }
};


exports.updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    // تحديث بعطلة تخص المالك
    const updated = await OfficialHoliday.findOneAndUpdate(
      { _id: id, owner: req.userId },
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: 'Holiday not found or not owned by you' });
    }
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error updating holiday' });
  }
};


exports.deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    // حذف بعطلة يملكها المالك
    const deleted = await OfficialHoliday.findOneAndDelete({ _id: id, owner: req.userId });
    if (!deleted) {
      return res.status(404).json({ message: 'Holiday not found or not owned by you' });
    }
    res.json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error deleting holiday' });
  }
};
