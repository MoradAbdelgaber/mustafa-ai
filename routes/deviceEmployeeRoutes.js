// routes/deviceEmployeeRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const ctrl = require('../controllers/deviceEmployeeController');

router.post('/', authMiddleware, ctrl.createDeviceEmployee);
router.get('/', authMiddleware, ctrl.getAllDeviceEmployees);
router.get('/:id', authMiddleware, ctrl.getDeviceEmployeeById);
router.put('/:id', authMiddleware, ctrl.updateDeviceEmployee);
router.delete('/:id', authMiddleware, ctrl.deleteDeviceEmployee);

module.exports = router;
