// controllers/pdfDesignController.js
const PDFDesign = require('../models/PDFDesign');

exports.createPDFDesign = async (req, res) => {
  try {
    const design = await PDFDesign.create(req.body);
    res.status(201).json(design);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error creating PDF design' });
  }
};

exports.getAllPDFDesigns = async (req, res) => {
  try {
    const data = await PDFDesign.find({});
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching PDF designs' });
  }
};

exports.getPDFDesignById = async (req, res) => {
  try {
    const { id } = req.params;
    const design = await PDFDesign.findById(id);
    if(!design) {
      return res.status(404).json({ message: 'PDF Design not found' });
    }
    res.json(design);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error fetching PDF design' });
  }
};

exports.updatePDFDesign = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await PDFDesign.findByIdAndUpdate(id, req.body, { new: true });
    if(!updated) {
      return res.status(404).json({ message: 'PDF Design not found' });
    }
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error updating PDF design' });
  }
};

exports.deletePDFDesign = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await PDFDesign.findByIdAndDelete(id);
    if(!deleted) {
      return res.status(404).json({ message: 'PDF Design not found' });
    }
    res.json({ message: 'PDF Design deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error deleting PDF design' });
  }
};
