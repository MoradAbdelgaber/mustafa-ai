const express = require('express');
const router = express.Router();
const activitionController = require('../controllers/activitionController');
const { authMiddleware } = require('../auth');
// جلب سجل Activition
router.get('/',authMiddleware, activitionController.getActivition);

// تعديل سجل Activition (يُعدل فقط حقل name)
router.put('/', authMiddleware,activitionController.updateActivition);

module.exports = router;
