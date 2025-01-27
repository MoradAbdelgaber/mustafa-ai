// models/RewardsAndPenalties.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const rpSchema = new Schema({
  employee_name: { type: String, required: true },
  enroll_id: { type: Number, required: true },
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
  reason: { type: String },
  performed_by: { type: String, required: true },
  added_date: { type: Date, required: true },

  // الحقل الجديد يربط السجل بمستخدم معيّن (المالك)
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('RewardsAndPenalties', rpSchema);
