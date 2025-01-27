// routes/vacationTypeRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const ctrl = require('../controllers/vacationTypeController');

router.post('/', authMiddleware, ctrl.createVacationType);
router.get('/', authMiddleware, ctrl.getAllVacationTypes);
router.get('/:id', authMiddleware, ctrl.getVacationTypeById);
router.put('/:id', authMiddleware, ctrl.updateVacationType);
router.delete('/:id', authMiddleware, ctrl.deleteVacationType);

module.exports = router;
