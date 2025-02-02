// models/FingerPrintLog.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const fingerPrintLogSchema = new Schema(
  {
    enrollid: { type: Number, required: true },
    name: { type: String },
    time: { type: Date, required: true },
    mode: { type: Number },
    inout: { type: Number },
    operation_id: { type: Number },
    device_sn: { type: String }, // في createLog استخدمت "serialNumber" ولكن في السكيمة موجود "device_sn"
    fetch_date: { type: Date },
    user_id: { type: Number },
    department: { type: String },
    modified_time: { type: Date },
    modification_reason: { type: String },
    modification_date: { type: Date },
    modified_by: { type: String },
    event: { type: Number },
    temp: { type: Number },
    verifymode: { type: Number },
    image: { type: String },
    device_type: { type: String },
    is_paid: { type: Boolean, default: false },
    device_name: { type: String, default: "" },

    // الحقل الجديد الذي يشير إلى مستخدم معيّن (المالك)
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("FingerPrintLog", fingerPrintLogSchema);
