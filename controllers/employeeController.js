// controllers/employeeController.js

const Employee = require("../models/Employee");
const bcrypt = require("bcryptjs");
const createHttpError = require("http-errors");
const createError = require("http-errors");
const jwt = require("jsonwebtoken");

exports.createEmployee = async (req, res, next) => {
  try {
    //check username
    if (req.body.username) {
      const count = await Employee.countDocuments({
        username: req.body.username,
      });
      if (count)
        throw createError.BadRequest(
          "Employee with this username already exists"
        );
    } else {
      //auto generate one
      const count = await Employee.countDocuments({
        owner: req.userId,
        enroll_id: req.body.enroll_id,
      });

      if (count)
        throw createError.BadRequest(
          `Employee with this enroll_id ${req.body.enroll_id} already exists`
        );

      req.body.username = `emp-${req.body.enroll_id}.${req.user.user_name}`;
      req.body.password = process.env.defaultEmployeePassword;
    }

    //create employee
    const employeeData = {
      ...req.body,
      password: await bcrypt.hash(req.body.password, 10),
      owner: req.userId, //owner Id
      weekSchedules: req.user.weekSchedules, //default owner weekSchedules
    };

    const newEmp = await Employee.create(employeeData);
    const { password, ...result } = newEmp._doc;
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

// تعديل متعدد
exports.multiUpdateEmployees = async (req, res) => {
  try {
    let { ids, update, all } = req.body;

    const query = all ? { owner: req.userId } : { _id: { $in: ids } };

    const updated = await Employee.updateMany(query, update);

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "Error updating employee" });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    // ابحث بشرط المالك
    const emp = await Employee.findOne({ _id: id, owner: req.userId }).select(
      "-password"
    );

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
      .limit(limitNum)
      .select("-password");

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

exports.updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findOne({ _id: id, owner: req.userId });
    if (!employee) throw createHttpError.NotFound("Employee not found");

    //check username & password
    if (!employee.password && !employee.username) {
      req.body.username = `emp-${employee.enroll_id}.${req.user.user_name}`;
      req.body.password = await bcrypt.hash(
        process.env.defaultEmployeePassword,
        10
      );
    } else {
      delete req.body.username;
      delete req.body.password;
    }

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

    const { password, ...result } = updatedEmp._doc;
    res.json(result);
  } catch (error) {
    next(error);
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

exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    const count = await Employee.countDocuments({ username });
    res.json({ exists: count > 0 });
  } catch (error) {
    res.status(400).json({ error: "Error checking username" });
  }
};

exports.login = async (req, res, next) => {
  try {
    const user = await Employee.findOne({ username: req.body.username });
    if (!user) {
      throw createError.Unauthorized("Invalid Credentials");
    }

    // تحقق من كلمة المرور
    const passwordMatch = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!passwordMatch) {
      throw createError.Unauthorized("Invalid Credentials");
    }

    const token = jwt.sign({ employeeId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30days",
    });

    const { password, ...result } = user._doc;
    res.json({ message: "Login successful", token, result });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { employee, password } = req.body;

    const emp = await Employee.findOne({ _id: employee, owner: req.userId });

    if (!emp) {
      return res
        .status(404)
        .json({ message: "Employee not found or not owned by you." });
    }

    emp.password = await bcrypt.hash(password, 10);
    await emp.save();

    res.json(emp);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Error fetching employee" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    res.status(200).json(req.employee);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
