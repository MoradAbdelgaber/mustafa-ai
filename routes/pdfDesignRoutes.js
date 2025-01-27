// routes/pdfDesignRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const ctrl = require('../controllers/pdfDesignController');

router.post('/', authMiddleware, ctrl.createPDFDesign);
router.get('/', authMiddleware, ctrl.getAllPDFDesigns);
router.get('/:id', authMiddleware, ctrl.getPDFDesignById);
router.put('/:id', authMiddleware, ctrl.updatePDFDesign);
router.delete('/:id', authMiddleware, ctrl.deletePDFDesign);

module.exports = router;
