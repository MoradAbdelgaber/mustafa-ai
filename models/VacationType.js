// models/VacationType.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const vacationTypeSchema = new Schema({
  vacation_name: { type: String, required: true },

  // الحقل الجديد يشير إلى مالك السجل (مستخدم معيّن)
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('VacationType', vacationTypeSchema);
