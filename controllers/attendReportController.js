// controllers/attendReportController.js
const AttendReport = require('../models/AttendReport');

exports.createReport = async (req, res) => {
  try {
    const report = await AttendReport.create(req.body);
    res.status(201).json(report);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error creating attend report' });
  }
};

exports.getAllReports = async (req, res) => {
  try {
    const reports = await AttendReport.find({});
    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching attend reports' });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await AttendReport.findById(id);
    if(!report) {
      return res.status(404).json({ message: 'Attend report not found' });
    }
    res.json(report);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error fetching attend report' });
  }
};

exports.updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedReport = await AttendReport.findByIdAndUpdate(id, req.body, { new: true });
    if(!updatedReport) {
      return res.status(404).json({ message: 'Attend report not found' });
    }
    res.json(updatedReport);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error updating attend report' });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await AttendReport.findByIdAndDelete(id);
    if(!deleted) {
      return res.status(404).json({ message: 'Attend report not found' });
    }
    res.json({ message: 'Attend report deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error deleting attend report' });
  }
};
