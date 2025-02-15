const nodemailer = require("nodemailer");
const VerificationCodeModel = require("../models/VerificationCode");

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 465, // Common ports: 465 (SSL), 587 (TLS)
    secure: true, // `true` for port 465, `false` for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOpts = {
    from: `TimeAttendHR <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  await transporter.sendMail(mailOpts);
  return true;
};

const sendVerificationEmail = async (email) => {
  try {
    // Check for recent verification attempts in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = await VerificationCodeModel.find({
      email,
      createdAt: { $gte: oneHourAgo },
    });

    // If 3 or more attempts found within 1 hour
    if (recentAttempts.length >= 3) {
      const oldestAttempt = recentAttempts[0];
      const blockEndTime = new Date(
        oldestAttempt.createdAt.getTime() + 60 * 60 * 1000
      );
      const timeRemaining = blockEndTime - new Date();

      // Convert remaining time to minutes
      const minutesRemaining = Math.ceil(timeRemaining / (60 * 1000));

      throw new Error(
        `Too many verification attempts. Please wait ${minutesRemaining} minutes before requesting a new code.`
      );
    }

    // Generate new verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // Send email
    await sendEmail({
      email,
      subject: "Email Verification Code",
      message: `Your verification code is: ${verificationCode}. Please verify your email.`,
    });
    await VerificationCodeModel.create({
      email,
      code: verificationCode,
    });
    return {
      success: true,
      message: "Email Verification Code Success",
    };
  } catch (error) {
    throw new Error(error.message || "Error sending verification email");
  }
};

// Check verification code
const checkVerificationCode = async (email, code) => {
  try {
    // Find the verification code in the database
    const verificationRecord = await VerificationCodeModel.findOne({
      email,
      code,
    });

    if (!verificationRecord) {
      return false;
    }

    // Delete the verification code after successful verification
    await VerificationCodeModel.deleteOne({ _id: verificationRecord._id });

    return true;
  } catch (error) {
    throw new Error("Error checking verification code");
  }
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  checkVerificationCode,
};
