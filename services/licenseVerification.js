// licenseVerification.js
const jwt = require("jsonwebtoken");
const { machineIdSync } = require("node-machine-id");
const Device = require("../models/Device");
const Employee = require("../models/Employee");

async function verifyLicense(licenseToken, currentDomain) {
  const secret = "iraqsoft";
  let decoded;
  
  try {
    decoded = jwt.verify(licenseToken, secret, { algorithms: ["HS256"] });
  } catch (error) {
    throw new Error("فشل فك التشفير أو الترخيص غير صحيح: " + error.message);
  }

  const { domain, allowedDevices, allowedEmployees, issuedAt, expiresAt, machineId } = decoded;
  const now = Date.now();
  if (now < new Date(issuedAt).getTime() || now > new Date(expiresAt).getTime()) {
    throw new Error("الترخيص غير صالح في هذا الوقت.");
  }

  if (domain !== currentDomain) {
    throw new Error("الدومين الموجود في الترخيص غير مطابق للدومين الحالي.");
  }

  // استرداد المعرف الفريد للجهاز الحالي
  const currentMachineId = machineIdSync();
  if (machineId !== currentMachineId) {
    throw new Error("معرّف الجهاز الحالي لا يطابق معرّف الجهاز في الترخيص.");
  }

  const deviceCount = await Device.countDocuments({ /* مثلاً: owner: req.userId */ });
  if (deviceCount > allowedDevices) {
    throw new Error(`عدد الأجهزة المسجلة (${deviceCount}) يتجاوز الحد المسموح به (${allowedDevices}).`);
  }

  const employeeCount = await Employee.countDocuments({ /* مثلاً: owner: req.userId */ });
  if (employeeCount > allowedEmployees) {
    throw new Error(`عدد الموظفين (${employeeCount}) يتجاوز الحد المسموح به (${allowedEmployees}).`);
  }

  return true;
}

module.exports = { verifyLicense };
