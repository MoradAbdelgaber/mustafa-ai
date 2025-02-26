// models/TimeSlot.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * يمثل "تعريف وقت" في نظام الشفت:
 * - name: اسم الوصف (مثلاً "Morning-8to16" أو "Night-22to08" ...)
 * - startTime/endTime: وقت البدء/الانتهاء (نص HH:MM:SS)
 * - offset: كم يومًا يمتد الخروج؟ (0 يعني نفس اليوم، 1 يعني ينتهي في اليوم التالي..)
 * - workRegistrationStartTime/lastEntryPreventionTime: لتحديد الحدود الزمنية المتاحة للتسجيل
 * - overtimeStartTime: متى يبدأ حساب الأوفر تايم
 * - allowedDelayMinutes: الدقائق المسموح بها للتأخير قبل اعتبار الموظف متأخراً
 * - allowedExitMinutes: الدقائق المسموح بها للخروج المبكر قبل احتسابه مبكراً
 * - officialWorkingHours: عدد الساعات الرسمية للعمل (يمكن حسابها أو تركها يدوياً)
 * - minimumWorkingHoursOvertime: أقل عدد ساعات عمل ليُحسب بعدها أوفر تايم
 * - ...
 */

const timeSlotSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },

    // الأوقات
    startTime: { type: String, default: "08:00:00" },
    endTime: { type: String, default: "17:00:00" },
    offset: { type: Number, default: 0 }, // 0 => نفس اليوم, 1 => ينتهي في اليوم التالي

    // حدود تسجيل الحضور
    workRegistrationStartTime: { type: String, default: "06:00:00" },
    lastEntryPreventionTime: { type: String, default: "11:00:00" },
    first_exit_allowed_time: { type: String, default: "15:00:00" },
    last_exit_allowed_time: { type: String, default: "20:00:00" },
    // الأوفر تايم
    overtimeStartTime: { type: String, default: "17:30:00" },
    minimumWorkingHoursOvertime: { type: Number, default: 10 }, // ساعات

    // سماحيات التأخير والخروج المبكر
    allowedDelayMinutes: { type: Number, default: 0 },
    allowedExitMinutes: { type: Number, default: 0 },

     // إضافة حقل اللون لتحديد لون كل سلوت
     color: { type: String, default: "#000000" },

    // عدد الساعات الرسمية (يمكن حسابها أو إدخاله يدويًا)
    officialWorkingHours: { type: Number, default: 8 },

    // بالنسبة لحساب الراتب/السعر
    hourPrice: { type: Number, default: 0 },
    overtimePrice: { type: Number, default: 0 },
    dailySalary: { type: Number, default: 0 },
    worksForDailyWage: { type: Boolean, default: false },
    overtimeEligible: { type: Boolean, default: false },

    // الحقول الجديدة التي ترغب بجعلها يومية:
    late_cutting_by_count: { type: Number, default: 0 },
    absent_cutting: { type: Number, default: 0 },
    early_cutting_by_count: { type: Number, default: 0 },
    late_min_prices: { type: Number, default: 0 },
    early_min_prices: { type: Number, default: 0 },
    allowed_min_rest: { type: Number, default: 0 },
    rest_min_prices: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TimeSlot", timeSlotSchema);
