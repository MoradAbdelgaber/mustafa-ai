// controllers/statusNameController.js
const StatusName = require('../models/StatusName');

exports.createStatusName = async (req, res) => {
  try {
    const status = await StatusName.create(req.body);
    res.status(201).json(status);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error creating status name' });
  }
};

exports.getAllStatusNames = async (req, res) => {
  try {
    const data = await StatusName.find({});
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching status names' });
  }
};

exports.getStatusNameById = async (req, res) => {
  try {
    const { id } = req.params;
    const status = await StatusName.findById(id);
    if(!status) {
      return res.status(404).json({ message: 'Status name not found' });
    }
    res.json(status);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error fetching status name' });
  }
};

exports.updateStatusName = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await StatusName.findByIdAndUpdate(id, req.body, { new: true });
    if(!updated) {
      return res.status(404).json({ message: 'Status name not found' });
    }
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error updating status name' });
  }
};

exports.deleteStatusName = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await StatusName.findByIdAndDelete(id);
    if(!deleted) {
      return res.status(404).json({ message: 'Status name not found' });
    }
    res.json({ message: 'Status name deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error deleting status name' });
  }
};
