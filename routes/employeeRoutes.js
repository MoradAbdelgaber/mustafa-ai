// routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const employeeController = require('../controllers/employeeController');

router.post('/', authMiddleware, employeeController.createEmployee);
router.get('/', authMiddleware, employeeController.getEmployees);
router.get('/:id', authMiddleware, employeeController.getEmployeeById);
router.put('/:id', authMiddleware, employeeController.updateEmployee);
router.delete('/:id', authMiddleware, employeeController.deleteEmployee);

module.exports = router;
