// controllers/userController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.registerUser = async (req, res) => {
  try {
    const { user_name, pass, display_name, timeZone } = req.body;

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
    });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { user_name, pass } = req.body;
    const user = await User.findOne({ user_name });
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

    res.status(200).json({ message: "Login successful", token });
  } catch (err) {
    console.error(err);
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
