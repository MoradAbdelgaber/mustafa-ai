// models/StatusName.js
const mongoose = require('mongoose');

const statusNameSchema = new mongoose.Schema({
  status_code: { type: String, unique: true, required: true },
  status_name: { type: String, required: true },
  text_color: { type: String, default: '#16151C' },
  back_color: { type: String, default: '#FFFFFF' }
}, {
  timestamps: true
});

module.exports = mongoose.model('StatusName', statusNameSchema);
