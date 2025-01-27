// routes/departmentRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const departmentController = require('../controllers/departmentController');

router.post('/', authMiddleware, departmentController.createDepartment);
router.get('/', authMiddleware, departmentController.getAllDepartments);
router.get('/:id', authMiddleware, departmentController.getDepartmentById);
router.put('/:id', authMiddleware, departmentController.updateDepartment);
router.delete('/:id', authMiddleware, departmentController.deleteDepartment);

module.exports = router;
