// models/TimeBasedLeave.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const timeBasedLeaveSchema = new Schema({
  employee_name: { type: String, required: true },
  enroll_id: { type: Number, required: true },
  leave_duration_for_entry: { type: Number, default: 0 },
  leave_duration_for_exit: { type: Number, default: 0 },
  paid_or_unpaid: { 
    type: String, 
    enum: ['Paid','Unpaid'],
    default: 'Unpaid'
  },
  leave_date: { type: Date, required: true },
  leave_reason: { type: String },
  added_by: { type: String, required: true },
  added_date: { type: Date, required: true },
  status: { type: String, default: 'Pending' },
  from_time: { type: String },
  to_time: { type: String },

  // الحقل الجديد الذي يشير إلى مالك هذا السجل (المستخدم)
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TimeBasedLeave', timeBasedLeaveSchema);
