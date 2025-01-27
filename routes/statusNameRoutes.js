// routes/statusNameRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const ctrl = require('../controllers/statusNameController');

router.post('/', authMiddleware, ctrl.createStatusName);
router.get('/', authMiddleware, ctrl.getAllStatusNames);
router.get('/:id', authMiddleware, ctrl.getStatusNameById);
router.put('/:id', authMiddleware, ctrl.updateStatusName);
router.delete('/:id', authMiddleware, ctrl.deleteStatusName);

module.exports = router;
