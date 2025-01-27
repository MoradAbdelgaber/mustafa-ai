// models/dayScheduleSchema.js
const mongoose = require('mongoose');

/**
 * هذا المخطط (Schema) يمثل إعدادات “يوم واحد” في جدول دوام الموظف.
 * يمكن أن تضع بداخله جميع الحقول التي تريدها “حسب اليوم”.
 */
const dayScheduleSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    required: true
  },

  // وقت الدخول الرسمي + الخروج الرسمي + بداية الأوفر تايم
  startTime: { type: String, default: '08:00:00' },
  endTime: { type: String, default: '17:00:00' },
  overtimeStart: { type: String, default: '17:30:00' },
  endDayOffset: { type: Number, default: 0 },

  // سعر الساعة العادي + الأوفر تايم
  hourPrice: { type: Number, default: 0 },
  overtimePrice: { type: Number, default: 0 },

  // التأخير المسموح والخروج المبكر المسموح
  allowed_delay_minutes: { type: Number, default: 0 },
  allowed_exit_minutes: { type: Number, default: 0 },

  // الحقول الجديدة التي ترغب بجعلها يومية:
  official_working_hours: { type: Number, default: 8 },
  late_cutting_by_count: { type: Number, default: 0 },
  absent_cutting: { type: Number, default: 0 },
  daily_salary: { type: Number, default: 0 },
  early_cutting_by_count: { type: Number, default: 0 },
  late_min_prices: { type: Number, default: 0 },
  early_min_prices: { type: Number, default: 0 },
  minimum_working_hours_overtime: { type: Number, default: 10 },
  work_registration_start_time: { type: String, default: '06:00:00' },
  last_entry_prevention_time: { type: String, default: '11:00:00' },
  first_exit_allowed_time: { type: String, default: '15:00:00' },
  last_exit_allowed_time: { type: String, default: '20:00:00' },
  works_for_daily_wage: { type: Boolean, default: false },
  overtime_eligible: { type: Boolean, default: false },
  allowed_min_rest: { type: Number, default: 0 },
  rest_min_prices: { type: Number, default: 0 }


}, {
  _id: false
});

module.exports = dayScheduleSchema;
