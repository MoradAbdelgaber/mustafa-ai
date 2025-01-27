// models/DeviceEmployee.js
const mongoose = require('mongoose');

const deviceEmployeeSchema = new mongoose.Schema({
  device_id: { type: Number },
  employee_id: { type: Number }
}, {
  timestamps: true
});

module.exports = mongoose.model('DeviceEmployee', deviceEmployeeSchema);
