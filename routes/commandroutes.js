// routes/commandroutes.js
const express = require("express");
const router = express.Router();
const commandController = require("../controllers/commandController");
// ميدلوير للتحقق من المصادقة (مثال)
const { authMiddleware } = require('../auth');


// لإنشاء أمر جديد
router.post('/', commandController.createCommand);

// لتحديث الأمر بعد معرفة النتيجة
router.put('/:id', commandController.updateCommand);

module.exports = router;
