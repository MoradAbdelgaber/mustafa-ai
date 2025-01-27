// routes/timeBasedLeaveRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const ctrl = require('../controllers/timeBasedLeaveController');

router.post('/', authMiddleware, ctrl.createLeave);
router.get('/', authMiddleware, ctrl.getAllLeaves);
router.get('/:id', authMiddleware, ctrl.getLeaveById);
router.put('/:id', authMiddleware, ctrl.updateLeave);
router.delete('/:id', authMiddleware, ctrl.deleteLeave);

module.exports = router;
