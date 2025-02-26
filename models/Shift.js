// models/Shift.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * نموذج لتعريف الشفت, مثلاً:
 * - shiftName: اسم الشفت
 * - cycleUnit: نوع الدورة (Week/Month) - هل تدوير أسبوعي أم شهري
 * - cycleLength: مثلاً 1 => كل أسبوع, 4 => كل 4 أسابيع...
 * - daysMap: مصفوفة/كائن يحدد لكل يوم (من الدورة) أي TimeSlot مستخدم
 *    مثال: اذا cycleUnit=Week => [index=0 => الأحد, index=1 => الاثنين ...الخ]
 *    أو يمكنك بدلاً من المصفوفة، استخدام حقول: SundaySlot=ObjectId, MondaySlot=..., الخ
 */

const shiftSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shiftName: { type: String, required: true },
    cycleUnit: { type: String, default: "Week" }, // أو "Month"
     // تاريخ بداية الدورة
     cycleStartDate: { type: Date }, // يمكن تحديد default إذا رغبت، مثل: default: Date.now
    cycleLength: { type: Number, default: 1 },

    // خارطة الأيام (7 أيام للأسبوع مثلاً). 
    // كل عنصر يشير إلى الـTimeSlot المستخدم في ذلك اليوم.
    daysMap: [
      {
        dayIndex: { type: Number }, // 0=Sun, 1=Mon, ... 6=Sat
        timeSlot: {
          type: Schema.Types.ObjectId,
          ref: "TimeSlot",
        },
      },
    ],

    // لو أردت تطبيق autoShift أو weeklyOvertime flags
    autoShift: { type: Boolean, default: false },
    weeklyOvertime: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Shift", shiftSchema);
