// controllers/departmentController.js
const Department = require('../models/Department');

exports.createDepartment = async (req, res) => {
  try {
    // ننسخ المدخلات من البدي ونضيف الـ owner
    const deptData = {
      ...req.body,
      owner: req.userId  // تأكد أن لديك middleware يعبئ req.userId
    };

    const dept = await Department.create(deptData);
    res.status(201).json(dept);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error creating department' });
  }
};

exports.getAllDepartments = async (req, res) => {
  try {
    // رشّح بالمالك
    const departments = await Department.find({ owner: req.userId });
    res.json(departments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching departments' });
  }
};


exports.getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    // ابحث بشرط أن _id = id و owner = req.userId
    const dept = await Department.findOne({ _id: id, owner: req.userId });

    if (!dept) {
      return res.status(404).json({ message: 'Department not found or not owned by you' });
    }
    res.json(dept);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error fetching department' });
  }
};


exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedDept = await Department.findOneAndUpdate(
      { _id: id, owner: req.userId },  // تأكيد أن المالك هو نفس المستخدم
      req.body,
      { new: true }
    );

    if (!updatedDept) {
      return res.status(404).json({ message: 'Department not found or not owned by you' });
    }
    res.json(updatedDept);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error updating department' });
  }
};


exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedDept = await Department.findOneAndDelete({ _id: id, owner: req.userId });

    if (!deletedDept) {
      return res.status(404).json({ message: 'Department not found or not owned by you' });
    }
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error deleting department' });
  }
};

