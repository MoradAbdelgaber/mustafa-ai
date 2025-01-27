// controllers/attendanceDesignController.js
const AttendanceDesign = require('../models/AttendanceDesign');

exports.createDesign = async (req, res) => {
  try {
    const design = await AttendanceDesign.create(req.body);
    res.status(201).json(design);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error creating attendance design' });
  }
};

exports.getAllDesigns = async (req, res) => {
  try {
    const designs = await AttendanceDesign.find({});
    res.json(designs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching attendance designs' });
  }
};

exports.getDesignById = async (req, res) => {
  try {
    const { id } = req.params;
    const design = await AttendanceDesign.findById(id);
    if(!design) {
      return res.status(404).json({ message: 'Design not found' });
    }
    res.json(design);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error fetching design' });
  }
};

exports.updateDesign = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedDesign = await AttendanceDesign.findByIdAndUpdate(id, req.body, { new: true });
    if(!updatedDesign) {
      return res.status(404).json({ message: 'Design not found' });
    }
    res.json(updatedDesign);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error updating design' });
  }
};

exports.deleteDesign = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await AttendanceDesign.findByIdAndDelete(id);
    if(!deleted) {
      return res.status(404).json({ message: 'Design not found' });
    }
    res.json({ message: 'Attendance design deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error deleting design' });
  }
};
