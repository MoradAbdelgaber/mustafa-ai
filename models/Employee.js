// models/Employee.js

const mongoose = require('mongoose');
const dayScheduleSchema = require('./dayScheduleSchema');
const Schema = mongoose.Schema;

const employeeSchema = new Schema({
  enroll_id: { type: Number, required: true },
  serial_number: { type: String },
  insertion_date: { type: Date },
  aliasid: { type: String },
  name: { type: String, required: true },
  department: { type: String },  // يمكنك ربطه مستقبلاً بنموذج Department 
  shift: { type: Number },
  admin: { type: Number },
  fingerprint: { type: String },
  palm: { type: Number },
  week_zone: { type: Number },
  face: { type: Number },
  password: { type: String },
  card: { type: Number },
  weekzone: { type: Number },
  user_group: { type: Number },
  verifymode: { type: Number },
  birthday: { type: Date },
  starttime: { type: String },
  endtime: { type: String },
  photourl: { type: String },
  userprofile: { type: String },
  main_salary: { type: Number },
  daily_salary: { type: Number },
  hour_prices: { type: Number },
  hour_overtime_prices: { type: Number },
  absent_cutting: { type: Number },
  late_cutting_by_count: { type: Number },
  early_cutting_by_count: { type: Number },
  late_min_prices: { type: Number },
  early_min_prices: { type: Number },
  late_entry: { type: String, default: '08:00:00' },
  early_exit: { type: String, default: '17:00:00' },
  overtime_start: { type: String, default: '17:30:00' },
  work_days: { type: String, default: 'SunMonTueWedThu' },
  official_working_hours: { type: Number, default: 8.0 },
  minimum_working_hours_overtime: { type: Number, default: 10.0 },
  image_blob: { type: Buffer },
  email: { type: String },
  mobile_number: { type: String },
  marital_status: { type: String },
  gender: { type: String },
  address: { type: String },
  joining_date: { type: Date },
  leave_date: { type: Date },
  document: { type: String },
  employee_type: { type: String },
  work_registration_start_time: { type: String },
  last_entry_prevention_time: { type: String },
  allowed_delay_minutes: { type: Number },
  allowed_exit_minutes: { type: Number },
  works_for_daily_wage: { type: Boolean },
  overtime_eligible: { type: Boolean },
  weekSchedules: {
    type: [dayScheduleSchema],
    default: []
  },
  devices: {
    type: [String],
    default: []
  },
  works_past_midnight: { type: Boolean, default: false },
  work_registration_end_time: { type: String },
  checkout_grace_period: { type: String },
  department_id: {
    type: Schema.Types.ObjectId,
    ref: 'Department'
  },
  payment_due_every: { type: Number },
  payment_due_every_day: { type: String },
  image: { type: String }, // حقل للصورة Base64 مثلًا

  // الحقل الجديد الذي يربط كل موظف بمستخدم معيّن (المالك)
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});
employeeSchema.index({ owner: 1, enroll_id: 1 }, { unique: true });

module.exports = mongoose.model('Employee', employeeSchema);
