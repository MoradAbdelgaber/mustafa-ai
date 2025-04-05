const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CommandSchema = new Schema({
  // المالك (ربط بالمستخدم)
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  // تاريخ التنفيذ
  executionDate: {
    type: Date
  },
  // نتيجة التنفيذ: يجب أن تكون "Wait" أو "Done" أو "Failed"
  executionResult: {
    type: String,
    enum: ["Wait", "Success", "Failed"]
  },
  // حقل رسالة الرد
  response: {
    type: String
  },

  // حقل الجهاز 
  device_sn: {
    type: String
  },

  // تخضع للتكرار أم لا (افتراضي: نعم)
  repeatable: {
    type: Boolean,
    default: true
  },
  // رابط السيرفر (يمكن تخزين بيانات بصيغة جيسون)
  server: {
    type: Schema.Types.Mixed,
    required: false
  },
  // نوع العملية (اسم العملية)
  operationType: {
    type: String,
    required: false,
    trim: true
  },
  // حقل لتخزين الـ body كامل كما في المثال:
  // {
  //    "sn": "{{SN}}",
  //    "enrollid": 700,
  //    "username": "justafa",
  //    "backupnum": 11, // يجب أن يكون Base 64 للأصابع من 0~9، 20-27 للوجه الثابت، 30-37 للمعالم، 50 للصورة
  //    "admin": 0, // إذا كان المستخدم admin أم لا
  //    "carddata": 5484946, // رقم البطاقة
  //    "fpdata": "19777"
  // }
  body: {
    type: Schema.Types.Mixed,
    required: true
  }
}, { timestamps: true }); // timestamps تتضمن تاريخ الإضافة (createdAt) وتاريخ التعديل (updatedAt)

module.exports = mongoose.model("Command", CommandSchema);
