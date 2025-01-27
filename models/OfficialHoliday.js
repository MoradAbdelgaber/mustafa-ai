// models/OfficialHoliday.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const officialHolidaySchema = new Schema({
  holiday_date: { type: Date, required: true },
  description: { type: String },
  note: { type: String },

  // حقل المالك
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// إذا أردت جعل holiday_date فريدًا لكل مستخدم فقط، أضف فهرس مركّب:
officialHolidaySchema.index({ owner: 1, holiday_date: 1 }, { unique: true });

module.exports = mongoose.model('OfficialHoliday', officialHolidaySchema);
