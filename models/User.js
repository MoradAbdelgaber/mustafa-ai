// models/User.js
const mongoose = require("mongoose");
const dayScheduleSchema = require("./dayScheduleSchema");
const { Roles } = require("../utils/roles");
const Branch = require("./Branch");
const userSchema = new mongoose.Schema(
  {
    user_name: { type: String, required: true, unique: true },
    pass: { type: String, required: true }, // سيتم تخزين كلمة المرور بشكل مشفّر
    display_name: { type: String },
    active: {
      type: Boolean,
      default: true,
    },
    //default time zone
    timeZone: { type: String, default: "Asia/Dubai" },
    //default week schedule
    weekSchedules: {
      type: [dayScheduleSchema],
      default: [],
    },
        // إضافة حقل الفروع على شكل مصفوفة من المراجع (References)
  branches: [{
    type: mongoose.Schema.Types.ObjectId
    
  }],
    email: {
      type: String,
      default: "",
    },
    roles: {
      type: [String],
      default: [Roles.ADMIN],
    },
 
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    //permissions
    permissions: {
      showDashboard: { type: Boolean, default: true },
      showEmployees: { type: Boolean, default: true },
      showAttendanceReport: { type: Boolean, default: true },
      showTimeLeaves: { type: Boolean, default: true },
      showOfficialHolidays: { type: Boolean, default: true },
      showLeaves: { type: Boolean, default: true },
      showAttendanceLog: { type: Boolean, default: true },
      showRewardsAndPenalities: { type: Boolean, default: true },
      showDevices: { type: Boolean, default: true },
      showRequests: { type: Boolean, default: true },
      showDepartments: { type: Boolean, default: true },
      showUnregisteredEmployees: { type: Boolean, default: true },
      showEmployeeSummaryReport: { type: Boolean, default: true },
      showLeavesTypes: { type: Boolean, default: true },
      showPublicSettings: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
