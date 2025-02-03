// routes/employeeRoutes.js
const express = require("express");
const router = express.Router();
const { authMiddleware, authEmployeeMiddleware } = require("../auth");
const employeeController = require("../controllers/employeeController");

router.post("/", authMiddleware, employeeController.createEmployee);
router.get("/", authMiddleware, employeeController.getEmployees);
router.get("/check-username", employeeController.checkUsername);
router.post("/login", employeeController.login);
router.get("/profile", authEmployeeMiddleware, employeeController.getProfile);
router.get("/:id", employeeController.getEmployeeById);
router.put(
  "/multi-update",
  authMiddleware,
  employeeController.multiUpdateEmployees
);
router.put("/reset-password", authMiddleware, employeeController.resetPassword);
router.put("/:id", authMiddleware, employeeController.updateEmployee);
router.delete("/:id", authMiddleware, employeeController.deleteEmployee);

module.exports = router;
