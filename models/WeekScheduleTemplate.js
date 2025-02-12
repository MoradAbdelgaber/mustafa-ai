const mongoose = require("mongoose");
const dayScheduleSchema = require("./dayScheduleSchema");

const Schema = mongoose.Schema;

const WeekScheduleTemplateSchema = new Schema(
  {
    name: { type: String, required: true },
    weekSchedules: {
      type: [dayScheduleSchema],
      default: [],
    },
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

module.exports = mongoose.model(
  "WeekScheduleTemplate",
  WeekScheduleTemplateSchema
);
