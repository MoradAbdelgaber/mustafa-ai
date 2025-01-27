// routes/attendanceDesignRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const ctrl = require('../controllers/attendanceDesignController');

router.post('/', authMiddleware, ctrl.createDesign);
router.get('/', authMiddleware, ctrl.getAllDesigns);
router.get('/:id', authMiddleware, ctrl.getDesignById);
router.put('/:id', authMiddleware, ctrl.updateDesign);
router.delete('/:id', authMiddleware, ctrl.deleteDesign);

module.exports = router;
