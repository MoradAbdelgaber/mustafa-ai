// models/Department.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const departmentSchema = new Schema({
  department_name: { type: String, required: true },
  department_status: { type: String }, // active / inactive
  mawjood_id: { type: String },
  devices: {
    type: [String],
    default: [],
  },
  branch: {
    type: Schema.Types.ObjectId,
    ref: "Branch",
  },

  // الحقل الجديد: يشير إلى من يملك هذا القسم
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Department', departmentSchema);
