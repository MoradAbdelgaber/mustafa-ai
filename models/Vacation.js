// models/Vacation.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VacationSchema = new Schema({
  enroll_id: {
    type: Number,
    required: true
  },
  employee_name: {
    type: String,
    required: true
  },
  vacation_start_date: {
    type: Date,
    required: true
  },
  vacation_end_date: {
    type: Date,
    required: true
  },
  vacation_type_id: {
    type: Schema.Types.ObjectId,
    ref: 'VacationType',
    required: true
  },
  reason: {
    type: String
  },
  is_paid: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Approved', 'Pending', 'Rejected'],
    default: 'Pending'
  },

  // الحقل الجديد الذي يشير إلى المالك (المستخدم)
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('Vacation', VacationSchema);
