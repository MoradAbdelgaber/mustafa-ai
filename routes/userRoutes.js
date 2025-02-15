// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  verifyEmail,
} = require("../controllers/userController");
const { authMiddleware } = require("../auth");

// لا نستخدم authMiddleware لأن التسجيل/الدخول لا يحتاجه
router.post("/verify-email", verifyEmail);
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);

module.exports = router;
