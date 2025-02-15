// models/Device.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const DeviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // اسم الجهاز
    serial: { type: String, required: true, unique: true }, // سيريال الجهاز
    status: { type: Boolean, default: true }, // حالة الجهاز (فعال أو لا)
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    serverip: { type: String, required: true }, // عنوان جهاز

    timeZone: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const Device = mongoose.model("Device", DeviceSchema);

module.exports = Device;
