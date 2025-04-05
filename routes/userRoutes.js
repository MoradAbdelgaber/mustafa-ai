// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  verifyEmail,
  getEmployees,
  registerEmployee,
  updateEmployee,
  deleteEmployee,
  loginEmployee,
} = require("../controllers/userController");
const { authMiddleware } = require("../auth");

// لا نستخدم authMiddleware لأن التسجيل/الدخول لا يحتاجه
router.post("/verify-email", verifyEmail);
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);

//employees
router.get("/employees", authMiddleware, getEmployees);
router.post("/employees", authMiddleware, registerEmployee);
router.post("/employees/login", loginEmployee);
router.put("/employees/:id", authMiddleware, updateEmployee);
router.delete("/employees/:id", authMiddleware, deleteEmployee);

router.get("/profile", authMiddleware, (req, res) => {
  // هنا ستجد req.userId, req.user, req.branches جاهزة للاستخدام
  res.json({
    userId: req.userId,
    user: req.user,
    branches: req.branches,
  });
});

module.exports = router;
