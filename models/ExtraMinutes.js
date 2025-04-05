const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const extraMinutesSchema = new Schema({
  employee_name: { type: String, required: true },
  enroll_id: { type: Number, required: true },
  minutes: { type: Number, required: true },
  bonus_date: { type: Date, required: true },
  added_by: { type: String, required: true },
  added_date: { type: Date, required: true },

  // الحقل الذي يشير إلى مالك هذا السجل (المستخدم صاحب البيانات)
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ExtraMinutes', extraMinutesSchema);
