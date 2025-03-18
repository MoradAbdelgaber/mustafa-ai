// models/FlexibleAggregateRule.js

const mongoose = require('mongoose');

/**
 * مثال لموديل قواعد تجميعية ذات مرونة عالية.
 */
const FlexibleAggregateRuleSchema = new mongoose.Schema({
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: true 
  },
  
  name: { 
    type: String, 
    default: "",
    // اسم تعبيري للقاعدة
  },

  // إذا true => تنطبق على جميع الموظفين
  applyToAll: { 
    type: Boolean, 
    default: false 
  },

  // إذا أردت تطبيقها على موظفين بأيديات محددة
  applyToEmployeeIds: [{ 
    type: Number 
    // مثل enroll_id
  }],

  // إذا أردت تطبيقها على أقسام محددة
  applyToDepartmentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],

  // فترة تطبيق القاعدة
  startDate: { 
    type: Date 
  },
  endDate: { 
    type: Date 
  },

  // هل نطبّق بشكل يومي أم أسبوعي أم شهري
  frequency: { 
    type: String, 
    enum: ['daily', 'weekly', 'monthly'], 
    default: 'monthly' 
  },

  // مثال: "tardiesCount > 3"
  // أو "absentCount >= 2 && frequency === 'monthly'"
  conditionScript: {
    type: String, 
    default: ""
  },

  // أنواع الأكشن المحتملة (يمكنك إضافة ما تشاء)
  // "addDay" = إضافة يوم حضور
  // "removeDay" = خصم يوم (اعتباره غياب)
  // "addAmount" = إضافة مبلغ
  // "removeAmount" = خصم مبلغ
  actionType: {
    type: String,
    enum: ['addDay','removeDay','addAmount','removeAmount'],
    default: 'addAmount'
  },

  // قيمة التنفيذ (مثلاً 5000 دينار، أو 1 يوم)
  actionValue: {
    type: Number,
    default: 0
  },

  // رسالة توضيحية تظهر في الحقل attendance_status
  message: {
    type: String,
    default: ""
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
});

module.exports = mongoose.model("FlexibleAggregateRule", FlexibleAggregateRuleSchema);
