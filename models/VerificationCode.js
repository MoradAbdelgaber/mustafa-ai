const mongoose = require("mongoose");

const verificationCodeSchema = mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const verificationCodeModel = mongoose.model(
  "VerificationCode",
  verificationCodeSchema
);

module.exports = verificationCodeModel;
