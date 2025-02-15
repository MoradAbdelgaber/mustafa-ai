// models/User.js
const mongoose = require("mongoose");
const dayScheduleSchema = require("./dayScheduleSchema");

const userSchema = new mongoose.Schema(
  {
    user_name: { type: String, required: true, unique: true },
    pass: { type: String, required: true }, // سيتم تخزين كلمة المرور بشكل مشفّر
    display_name: { type: String },
    show_dashboard: { type: Boolean, default: true },
    show_attendance: { type: Boolean, default: true },
    show_leaves: { type: Boolean, default: true },
    show_departments: { type: Boolean, default: true },
    show_employees: { type: Boolean, default: true },
    show_rewards_and_penalties: { type: Boolean, default: true },
    show_payroll: { type: Boolean, default: true },
    show_holidays: { type: Boolean, default: true },
    show_settings: { type: Boolean, default: true },
    show_access: { type: Boolean, default: true },
    //default time zone
    timeZone: { type: String, default: "Asia/Dubai" },
    //default week schedule
    weekSchedules: {
      type: [dayScheduleSchema],
      default: [],
    },
    email: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
