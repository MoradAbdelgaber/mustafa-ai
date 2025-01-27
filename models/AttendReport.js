// models/AttendReport.js
const mongoose = require('mongoose');

const attendReportSchema = new mongoose.Schema({
  serial_number: { type: String },
  insertion_date: { type: Date },
  enroll_id: { type: Number },
  name: { type: String },
  department: { type: String },
  shift: { type: String },
  report_date_range: { type: String },
  day: { type: String },
  week: { type: String },
  time: { type: String },
  flag: { type: String },
  fatten: { type: Number },
  fact_atten: { type: Number },
  dayot: { type: Number },
  daylate: { type: Number },
  dayLeaveearly: { type: Number },
  work_hour: { type: Number },
  atten_hour: { type: Number },
  work_days: { type: String },
  absent_days: { type: String },
  std_ot_hour: { type: String },
  ot_hour: { type: String },
  late_minute: { type: Number },
  late_times: { type: Number },
  leave_minute: { type: Number },
  leave_times: { type: Number },
  is_paid: { type: Boolean, default: false },
  last_modified: { type: Date },
  notes: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('AttendReport', attendReportSchema);
