// controllers/employeeController.js

const Employee = require("../models/Employee");

exports.createEmployee = async (req, res) => {
  try {
    // اضفنا owner: req.userId لضمان ربط الموظف بصاحب الحساب
    const employeeData = {
      ...req.body,
      owner: req.userId, // يجب أن يكون لديك مصادقة تعبئ req.userId
      weekSchedules: req.user.weekSchedules, //default owner weekSchedules
    };

    const newEmp = await Employee.create(employeeData);
    res.status(201).json(newEmp);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Error creating employee" });
  }
};
// تعديل موظف
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params; // أو _id أو enroll_id
    const updated = await Employee.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updated) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Error updating employee" });
  }
};

// تعديل متعدد
exports.multiUpdateEmployees = async (req, res) => {
  try {
    const { ids, update } = req.body;
    const updated = await Employee.updateMany(
      {
        _id: {
          $in: ids,
        },
      },
      update
    );

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "Error updating employee" });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    // ابحث بشرط المالك
    const emp = await Employee.findOne({ _id: id, owner: req.userId });
    if (!emp) {
      return res
        .status(404)
        .json({ message: "Employee not found or not owned by you." });
    }

    res.json(emp);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Error fetching employee" });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    // ترقيم الصفحات
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // نرشّح الموظفين بناءً على المالك
    const filter = { owner: req.userId };

    const employees = await Employee.find(filter)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const totalCount = await Employee.countDocuments(filter);

    res.json({
      data: employees,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching employees" });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    // ابحث عن الموظف بشرط المالك
    const updatedEmp = await Employee.findOneAndUpdate(
      { _id: id, owner: req.userId }, // الشرط
      req.body, // البيانات المراد تحديثها
      { new: true } // إعادة العنصر المحدث
    );

    if (!updatedEmp) {
      return res
        .status(404)
        .json({ message: "Employee not found or not owned by you." });
    }

    res.json(updatedEmp);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Error updating employee" });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // بحث وحذف بشرط المالك
    const deletedEmp = await Employee.findOneAndDelete({
      _id: id,
      owner: req.userId,
    });
    if (!deletedEmp) {
      return res
        .status(404)
        .json({ message: "Employee not found or not owned by you." });
    }

    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Error deleting employee" });
  }
};
