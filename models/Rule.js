const mongoose = require('mongoose');

// تعريف مخطط الإجراء
const ActionSchema = new mongoose.Schema({
  field: { type: String },   // اسم الحقل الذي ستطبّق عليه الإجراء
  type: { type: String },    // نوع الإجراء (set, increment, multiply, time_adjust, ...)
  value: { type: String } ,   // القيمة المراد استخدامها في الإجراء
  valueType: { type: String },
}, { _id: false });

// تعريف مخطط الشرط البسيط
const ConditionSchema = new mongoose.Schema({
  field: { type: String },
  operator: { type: String },
  valueType: { type: String },
  value: { type: String }
}, { _id: false });

// تعريف مخطط الكتلة الشرطية (conditionsBlock)
// نبدأ بتعريف subConditions كمصفوفة فارغة ثم نضيفها تكرارياً لاحقاً
const ConditionsBlockSchema = new mongoose.Schema({
  operator: { type: String, default: 'AND' },  // يمكن أن تكون "AND" أو "OR"
  conditions: [ConditionSchema],               // مصفوفة من الشروط البسيطة
  subConditions: []                            // سيتم تحديثها لاحقاً لتعكس نفس البنية
}, { _id: false });

// إضافة الحقل التكراري باستخدام add()
// هذا يضمن أن subConditions تحتوي على كائنات بنفس بنية ConditionsBlockSchema
ConditionsBlockSchema.add({ subConditions: [ConditionsBlockSchema] });

// تعريف مخطط القاعدة (Rule)
const RuleSchema = new mongoose.Schema({
  name: { type: String },
  priority: { type: Number, default: 0 },
  stopOnMatch: { type: Boolean, default: false },
  validFrom: { type: Date },
  validTo: { type: Date },
  conditionsBlock: ConditionsBlockSchema, // البنية المركبة للشروط
  actions: [ActionSchema],                // مصفوفة من الإجراءات
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // ربط بمالك القاعدة
}, { timestamps: true });

module.exports = mongoose.model('Rule', RuleSchema);
