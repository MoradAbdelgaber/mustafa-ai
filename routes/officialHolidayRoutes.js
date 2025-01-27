// routes/officialHolidayRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const ctrl = require('../controllers/officialHolidayController');

router.post('/', authMiddleware, ctrl.createHoliday);
router.get('/', authMiddleware, ctrl.getAllHolidays);
router.get('/:id', authMiddleware, ctrl.getHolidayById);
router.put('/:id', authMiddleware, ctrl.updateHoliday);
router.delete('/:id', authMiddleware, ctrl.deleteHoliday);

module.exports = router;
