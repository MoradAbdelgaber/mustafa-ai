// controllers/userController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  sendVerificationEmail,
  checkVerificationCode,
} = require("../utils/emailOtp");
const { Roles } = require("../utils/roles");

exports.registerUser = async (req, res) => {
  try {
    const { user_name, pass, display_name, timeZone, email, code } = req.body;

    //verify email
    const isVerified = await checkVerificationCode(email, code);
    if (!isVerified) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // تأكد أنه غير موجود
    const existingUser = await User.findOne({ user_name });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // تشفير كلمة المرور
    const hashedPass = await bcrypt.hash(pass, 10);

    // إنشاء المستخدم
    const newUser = new User({
      user_name,
      pass: hashedPass,
      display_name,
      timeZone,
      email,
      roles: [Roles.ADMIN],
    });
    await newUser.save();

    // إنشاء توكن
    const token = jwt.sign(
      { userId: newUser._id, userName: newUser.user_name },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.status(201).json({ message: "User registered successfully", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { email } = req.body;

    // تأكد أنه غير موجود
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "email already used" });
    }

    // تشفير كلمة المرور
    await sendVerificationEmail(email);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { user_name, pass } = req.body;
    const user = await User.findOne({
      user_name,
      active: true,
      roles: Roles.ADMIN,
    });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // تحقق من كلمة المرور
    const isMatch = await bcrypt.compare(pass, user.pass);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // إنشاء توكن
    const token = jwt.sign(
      { userId: user._id, userName: user.user_name },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      permissions: user.permission,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    delete req.body.pass;
    const saved = await User.findByIdAndUpdate(req.user._id, req.body, {
      new: true,
    });
    res.status(200).json(saved);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

//employees
exports.registerEmployee = async (req, res) => {
  try {
    const { user_name, pass, display_name } = req.body;

    // تأكد أنه غير موجود
    const existingUser = await User.findOne({ user_name });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const owner = await User.findById(req.user._id);
    if (!owner) {
      return res.status(400).json({ message: "owner not found" });
    }

    // تشفير كلمة المرور
    const hashedPass = await bcrypt.hash(pass, 10);

    // إنشاء المستخدم
    const newUser = new User({
      user_name,
      pass: hashedPass,
      display_name,
      roles: [Roles.USER],
      timeZone: owner.timeZone,
      owner: owner._id,
    });
    await newUser.save();

    res
      .status(201)
      .json({ message: "Employee registered successfully", employee: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;

    const filter = {
      owner: req.userId,
      roles: [Roles.USER],
    };

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const skip = (page - 1) * limit;
    const totalCount = await User.countDocuments(filter);

    const employees = await User.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createAt: -1 });

    res.json({
      employees,
      totalCount,
      currentPage: page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    if (req.body.pass) {
      const hashedPass = await bcrypt.hash(req.body.pass, 10);
      req.body.pass = hashedPass;
    }
    const employee = await User.findByIdAndUpdate(req.params.id, req.body);
    res.status(200).json(employee);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await User.findByIdAndDelete(req.params.id);
    res.status(200).json(employee);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.loginEmployee = async (req, res) => {
  try {
    const { user_name, pass } = req.body;
    const user = await User.findOne({
      user_name,
      active: true,
      roles: Roles.USER,
    });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // تحقق من كلمة المرور
    const isMatch = await bcrypt.compare(pass, user.pass);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // إنشاء توكن
    const token = jwt.sign(
      { userId: user._id, userName: user.user_name },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      permissions: user.permissions,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
