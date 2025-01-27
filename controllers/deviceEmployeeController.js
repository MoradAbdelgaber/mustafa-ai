// controllers/deviceEmployeeController.js
const DeviceEmployee = require('../models/DeviceEmployee');

exports.createDeviceEmployee = async (req, res) => {
  try {
    const record = await DeviceEmployee.create(req.body);
    res.status(201).json(record);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error creating device employee record' });
  }
};

exports.getAllDeviceEmployees = async (req, res) => {
  try {
    const data = await DeviceEmployee.find({});
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching device employees' });
  }
};

exports.getDeviceEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await DeviceEmployee.findById(id);
    if(!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error fetching record' });
  }
};

exports.updateDeviceEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await DeviceEmployee.findByIdAndUpdate(id, req.body, { new: true });
    if(!updated) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error updating record' });
  }
};

exports.deleteDeviceEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await DeviceEmployee.findByIdAndDelete(id);
    if(!deleted) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error deleting record' });
  }
};
