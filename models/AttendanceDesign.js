// models/AttendanceDesign.js
const mongoose = require('mongoose');

const attendanceDesignSchema = new mongoose.Schema({
  design_name: { type: String },
  show_official_working_hours: { type: Boolean, default: false },
  show_department: { type: Boolean, default: false },
  show_work_hours: { type: Boolean, default: false },
  show_attendance_status: { type: Boolean, default: false },
  show_delay_minutes: { type: Boolean, default: false },
  show_overtime_minutes: { type: Boolean, default: false },
  show_early_exit_minutes: { type: Boolean, default: false },
  show_net_salary: { type: Boolean, default: false },
  show_salary_based_on_daily_salary: { type: Boolean, default: false },
  show_modification_time: { type: Boolean, default: false },
  show_check_in: { type: Boolean, default: false },
  show_check_out: { type: Boolean, default: false },
  show_modified_by: { type: Boolean, default: false },
  show_basic_salary: { type: Boolean, default: false },
  show_salary_earned_for_work: { type: Boolean, default: false },
  show_overtime_entitlement: { type: Boolean, default: false },
  show_late_arrival_deduction: { type: Boolean, default: false },
  show_early_exit_deduction: { type: Boolean, default: false },
  show_absent_deduction: { type: Boolean, default: false },
  show_adjusted_hour_price: { type: Boolean, default: false },
  show_late_cutting_by_count: { type: Boolean, default: false },
  show_employee_name: { type: Boolean, default: false },
  show_employee_number: { type: Boolean, default: false },
  show_rewards_and_penalties: { type: Boolean, default: false },
  show_net_salary_before_rounding: { type: Boolean, default: false },
  show_modification_reason: { type: Boolean, default: false },
  showDate: { type: Boolean, default: false },
  earlyCuttingByCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

module.exports = mongoose.model('AttendanceDesign', attendanceDesignSchema);
