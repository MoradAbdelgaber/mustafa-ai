const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * RuleSchema:
 * - owner: معرف مالك الحساب (User) حتى تكون لكل مالك قواعده الخاصة.
 * - name: اسم وصفي للقاعــدة (مثلاً: "Late Very Condition").
 * - priority: أولوية التنفيذ (يتم فرز القواعد حسب هذه الأولوية تصاعديًا).
 * - stopOnMatch: إذا تحققت هذه القاعدة، نتوقف عن فحص بقية القواعد (true) أو نستمر (false).
 * - conditions: مصفوفة شروط (AND). كل شرط فيه:
 *     field: حقل من حقول سجل الحضور (مثل "event" أو "checkInTime")
 *     operator: مثل eq, ne, gt, lt, gtTime...إلخ
 *     value: القيمة المطلوب مقارنتها
 * - actions: الأفعال التي تطبَّق على السجل عند تحقق كل الشروط. كل فعل فيه:
 *     field: اسم الحقل المراد تعديله
 *     type: نوع التعديل ("set", "increment", "multiply" ...)
 *     value: القيمة المضافة/المعيّنة
 * - validFrom: تاريخ بدء صلاحية القاعدة (يمكن أن يكون null)
 * - validTo: تاريخ انتهاء صلاحية القاعدة (يمكن أن يكون null)
 */
const RuleSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  priority: { type: Number, default: 0 },
  stopOnMatch: { type: Boolean, default: false },
  conditions: [
    {
      field: { type: String, required: true },
      operator: { type: String, required: true },
      value: { type: String }  // يمكنك استخدام Mixed لو أردت المرونة
    }
  ],
  actions: [
    {
      field: { type: String, required: true },
      type: { type: String, required: true },
      value: { type: String } // نفس الملاحظة أعلاه
    }
  ],
  validFrom: { type: Date, default: null },
  validTo: { type: Date, default: null }
});

module.exports = mongoose.model('Rule', RuleSchema);
