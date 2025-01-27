// models/ApiRequest.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const apiRequestSchema = new Schema({
  url: { type: String, required: true },
  body: { type: Schema.Types.Mixed, required: true },
  ActionType: { type: String },
  result: { type: String },
  status: { type: String, default: 'pending' },
  date_insert: { type: Date, default: Date.now },
  date_done: { type: Date },
  day_of_week: { type: String },
  time_of_day: { type: String },
  repeat: { type: String, default: 'no' },
  last_executed_date: { type: Date },
  running_times: { type: Number, default: 0 },
  device_name: { type: String },
  operation_type: { type: String },

  // الحقل الجديد الذي يشير إلى المالك (المستخدم)
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ApiRequest', apiRequestSchema);
