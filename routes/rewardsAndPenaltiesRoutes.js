// routes/rewardsAndPenaltiesRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const ctrl = require('../controllers/rewardsAndPenaltiesController');

router.post('/', authMiddleware, ctrl.createRnP);
router.get('/', authMiddleware, ctrl.getAllRnP);
router.get('/:id', authMiddleware, ctrl.getRnPById);
router.put('/:id', authMiddleware, ctrl.updateRnP);
router.delete('/:id', authMiddleware, ctrl.deleteRnP);

module.exports = router;
