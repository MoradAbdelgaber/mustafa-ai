// controllers/deviceController.js
const Device = require('../models/Device');

exports.createDevice = async (req, res) => {
  try {
    // ننسخ البيانات من req.body ونضيف owner
    const deviceData = {
      ...req.body,
      owner: req.userId  // تأكد من وجود Middleware يضع userId في req.userId
    };

    const device = await Device.create(deviceData);
    res.status(201).json(device);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error creating device' });
  }
};

// Get all devices
exports.getAllDevices = async (req, res) => {
  try {
    // نرشّح بالأجهزة التي يملكها المستخدم
    const devices = await Device.find({ owner: req.userId });
    res.json(devices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching devices' });
  }
};

// Get a device by ID
exports.getDeviceById = async (req, res) => {
  try {
    const { id } = req.params;
    // نبحث باستخدام findOne ونرشّح بـ owner
    const device = await Device.findOne({ _id: id, owner: req.userId });
    if (!device) {
      return res.status(404).json({ message: 'Device not found or not owned by you' });
    }
    res.json(device);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error fetching device' });
  }
};


// Update a device by ID
exports.updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedDevice = await Device.findOneAndUpdate(
      { _id: id, owner: req.userId }, // تأكد أن الجهاز يخص نفس المستخدم
      req.body,
      { new: true }
    );
    if (!updatedDevice) {
      return res.status(404).json({ message: 'Device not found or not owned by you' });
    }
    res.json(updatedDevice);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error updating device' });
  }
};


// Delete a device by ID
exports.deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedDevice = await Device.findOneAndDelete({ _id: id, owner: req.userId });
    if (!deletedDevice) {
      return res.status(404).json({ message: 'Device not found or not owned by you' });
    }
    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error deleting device' });
  }
};
