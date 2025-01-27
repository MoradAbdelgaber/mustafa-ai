const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const deviceController = require('../controllers/deviceController');

// Create a new device
router.post('/', authMiddleware, deviceController.createDevice);

// Get all devices
router.get('/', authMiddleware, deviceController.getAllDevices);

// Get a device by ID
router.get('/:id', authMiddleware, deviceController.getDeviceById);

// Update a device by ID
router.put('/:id', authMiddleware, deviceController.updateDevice);

// Delete a device by ID
router.delete('/:id', authMiddleware, deviceController.deleteDevice);

module.exports = router;
