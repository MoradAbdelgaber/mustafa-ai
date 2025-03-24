// server.js

// تحميل متغيرات البيئة
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("bytenode");
const morgan = require("morgan");
const path = require("path");

// استيراد إعداد الاتصال بقاعدة البيانات
const connectDB = require("./config/db");

// استيراد الـ middleware للتوثيق
const { authMiddleware } = require("./auth");

// استيراد الكنترولرز والمسارات الخاصة بالمشروع الرئيسي
const activitionController = require("./controllers/activitionController");
const userRoutes = require("./routes/userRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const branchRoutes = require("./routes/branchRoutes");
const tagemployeeRoutes = require("./routes/tagemployeeRoutes");
const flexibleAggregateRuleRoutes = require("./routes/flexibleAggregateRuleRoutes");
const activitionRoutes = require("./routes/activitionRoutes");
const commandroutes = require("./routes/commandroutes");
const employeeRoutes = require("./routes/employeeRoutes");
const fingerPrintLogRoutes = require("./routes/fingerPrintLogRoutes");
const rewardsAndPenaltiesRoutes = require("./routes/rewardsAndPenaltiesRoutes");
const timeBasedLeaveRoutes = require("./routes/timeBasedLeaveRoutes");
const apiRequestRoutes = require("./routes/apiRequestRoutes");
const attendReportRoutes = require("./routes/attendReportRoutes");
const attendanceDesignRoutes = require("./routes/attendanceDesignRoutes");
const deviceEmployeeRoutes = require("./routes/deviceEmployeeRoutes");
const officialHolidayRoutes = require("./routes/officialHolidayRoutes");
const pdfDesignRoutes = require("./routes/pdfDesignRoutes");
const statusNameRoutes = require("./routes/statusNameRoutes");
const vacationTypeRoutes = require("./routes/vacationTypeRoutes");
const vacationRoutes = require("./routes/vacationRoutes");
const extraMinutesRoutes = require("./routes/extraMinutesRoutes");
const reportRoutes = require("./routes/reportRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const weekScheduleTemplatesRoutes = require("./routes/weekScheduleTemplatesRoutes");
const ruleRoutes = require("./routes/ruleRoutes");
const timeSlotRoutes = require("./routes/timeSlotRoutes");
const shiftRoutes = require("./routes/shiftRoutes");

// استيراد node-machine-id للحصول على معرف الجهاز
const { machineIdSync } = require("node-machine-id");

// ==========================================
// الجزء الخاص بالخادم الرئيسي (Main Server)
// ==========================================

const appMain = express();

// إعداد الـ middleware الخاصة بالخادم الرئيسي
appMain.use(bodyParser.json({ limit: "50mb" }));
appMain.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// الاتصال بقاعدة البيانات
connectDB();

// استخدام Morgan, Cors, و Express JSON middleware
appMain.use(morgan("dev"));
appMain.use(cors());
appMain.use(express.json());

// نقطة النهاية للحصول على معرف الجهاز
appMain.get("/api/machine-id", (req, res) => {
  try {
    const id = machineIdSync();
    res.json({ machineId: id });
  } catch (error) {
    res
      .status(500)
      .json({ error: "فشل الحصول على معرف الجهاز", details: error.message });
  }
});

// استدعاء دالة تهيئة التفعيل (إنشاء الباركود الافتراضي) عند بدء التشغيل
activitionController.initializeActivition();

// مسارات المستخدم (تسجيل / دخول)
appMain.use("/api/users", userRoutes);

// باقي المسارات الخاصة بالتطبيق
appMain.use(express.static(path.join(__dirname, "public")));
appMain.use("/api/departments", authMiddleware, departmentRoutes);
appMain.use("/api/employees", employeeRoutes);
appMain.use("/api/fingerprints", fingerPrintLogRoutes);
appMain.use(
  "/api/rewards-penalties",
  authMiddleware,
  rewardsAndPenaltiesRoutes
);
appMain.use("/api/time-based-leaves", authMiddleware, timeBasedLeaveRoutes);
appMain.use("/api/requests", authMiddleware, apiRequestRoutes);
appMain.use("/api/attend-reports", authMiddleware, attendReportRoutes);
appMain.use("/api/attendance-designs", attendanceDesignRoutes);
appMain.use("/api/device-employees", authMiddleware, deviceEmployeeRoutes);
appMain.use("/api/official-holidays", authMiddleware, officialHolidayRoutes);
appMain.use("/api/pdf-designs", pdfDesignRoutes);
appMain.use("/api/status-names", statusNameRoutes);
appMain.use("/api/vacation-types", vacationTypeRoutes);
appMain.use("/api/vacations", vacationRoutes);
appMain.use("/api/extra-minutes", extraMinutesRoutes);
appMain.use("/api/reports", reportRoutes);
appMain.use("/api/commands", commandroutes);
appMain.use("/api/branches", authMiddleware, branchRoutes);
appMain.use("/api/tagemployee", authMiddleware, tagemployeeRoutes);
appMain.use(
  "/api/flexibleAggregateRule",
  authMiddleware,
  flexibleAggregateRuleRoutes
);
appMain.use("/api/activition", authMiddleware, activitionRoutes);
appMain.use("/api/devices", authMiddleware, deviceRoutes);
appMain.use(
  "/api/weekSchedule-templates",
  authMiddleware,
  weekScheduleTemplatesRoutes
);
appMain.use("/api/rules", ruleRoutes);
appMain.use("/api/timeslots", timeSlotRoutes);
appMain.use("/api/shifts", shiftRoutes);

// إعادة التوجيه إلى صفحة تسجيل الدخول عند الدخول إلى الجذر
appMain.get("/", (req, res) => {
  res.redirect("/login.html");
});

// الـ middleware الخاص بالتعامل مع الأخطاء
appMain.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.json({ message: err.message, stack: err.stack });
});

// تشغيل الخادم الرئيسي على البورت المحدد
const PORT =
  (process.env.TYPE === "DEV" ? process.env.PORT_LOCAL : process.env.PORT) ||
  4089;
appMain.listen(PORT, () => {
  console.log(`Main server running on port ${PORT}`);
});

// ==========================================
// الجزء الخاص بخادم API الإضافي (على بورت منفصل)
// ==========================================

const appAPI = express();
const apiPort = process.env.PORT; // تأكد من ضبط هذا المتغير في ملف .env

// السماح بحجم payload كبير واستخدام CORS
appAPI.use(cors());
appAPI.use(express.json({ limit: "50mb" }));

// تشغيل الـ Job Scheduler
const JobScheduler = require("./utils/jobScheduler");
const jobScheduler = new JobScheduler();
jobScheduler.initialize();

// إنشاء مثيل لـ WebSocketLoader
const WebSocketLoader = require("./utils/webSocketLoader");
const webSocketLoader = new WebSocketLoader();

// نقطة النهاية: getuserlist
appAPI.post("/api/getuserlist", async (req, res) => {
  const { sn, from, to } = req.body;
  if (!sn) {
    console.error("getuserlist: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`getuserlist: Processing for SN ${sn}`);
    const data = await webSocketLoader.getUserList(sn, from, to);
    console.log("getuserlist: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("getuserlist Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقطة النهاية: getuserinfo ***********
appAPI.post("/api/getuserinfo", async (req, res) => {
  const { sn, enrollid, backupnum } = req.body;
  if (!sn || enrollid === undefined || backupnum === undefined) {
    console.error("getuserinfo: SN, enrollid, and backupnum are required");
    return res
      .status(400)
      .json({ error: "SN, enrollid, and backupnum are required" });
  }
  try {
    console.log(`getuserinfo: Processing for SN ${sn}`);
    const data = await webSocketLoader.getUserInfo(sn, enrollid, backupnum);
    console.log("getuserinfo: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("getuserinfo Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقطة النهاية: setuserinfo ***********
appAPI.post("/api/setuserinfo", async (req, res) => {
  let { sn, userInfo } = req.body;
  if (!sn || !userInfo) {
    const errMsg = "SN and userInfo are required";
    console.error("setuserinfo:", errMsg);
    return res.status(400).json({ error: errMsg });
  }

  console.log("setuserinfo: Received payload", userInfo);

  try {
    // خطوة 1: تحويل enrollid و backupnum من string إلى رقم إذا كانت كذلك
    if (typeof userInfo.enrollid === "string") {
      userInfo.enrollid = parseInt(userInfo.enrollid, 10);
      console.log("setuserinfo: Converted enrollid to", userInfo.enrollid);
    }
    if (typeof userInfo.backupnum === "string") {
      userInfo.backupnum = parseInt(userInfo.backupnum, 10);
      console.log("setuserinfo: Converted backupnum to", userInfo.backupnum);
    }

    // خطوة 2: إذا كانت الحقول الاختيارية (مثل zoneid، departmant، card) فارغة، يمكن حذفها
    if (!userInfo.zoneid) {
      console.log("setuserinfo: zoneid is empty, removing it");
      delete userInfo.zoneid;
    }
    if (!userInfo.departmant) {
      console.log("setuserinfo: departmant is empty, removing it");
      delete userInfo.departmant;
    }
    if (!userInfo.card) {
      console.log("setuserinfo: card is empty, removing it");
      delete userInfo.card;
    }

    console.log("setuserinfo: Final payload to be sent", userInfo);

    // خطوة 3: استدعاء الدالة التي تتواصل مع الجهاز وانتظار انتهائها
    console.log(`setuserinfo: Sending payload to device with SN ${sn}`);
    const data = await webSocketLoader.setUserInfo(sn, userInfo);
    console.log("setuserinfo: Operation completed successfully", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("setuserinfo Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقطة النهاية: deleteuser ***********
appAPI.post("/api/deleteuser", async (req, res) => {
  const { sn, enrollid, backupnum } = req.body;
  if (!sn || enrollid === undefined || backupnum === undefined) {
    console.error("deleteuser: SN, enrollid, and backupnum are required");
    return res
      .status(400)
      .json({ error: "SN, enrollid, and backupnum are required" });
  }
  try {
    console.log(`deleteuser: Processing for SN ${sn}`);
    const data = await webSocketLoader.deleteUser(sn, enrollid, backupnum);
    console.log("deleteuser: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("deleteuser Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقطة النهاية: cleanuser ***********
appAPI.post("/api/cleanuser", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("cleanuser: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`cleanuser: Processing for SN ${sn}`);
    const data = await webSocketLoader.cleanUser(sn);
    console.log("cleanuser: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("cleanuser Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقاط النهاية الخاصة بالسجلات ***********
appAPI.post("/api/getnewlog", async (req, res) => {
  const { sn, from, to } = req.body;
  if (!sn) {
    console.error("getnewlog: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`getnewlog: Processing for SN ${sn}`);
    const data = await webSocketLoader.getNewLog(sn, from, to);
    console.log("getnewlog: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("getnewlog Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/getalllog", async (req, res) => {
  const { sn, from, to, stn } = req.body;
  if (!sn) {
    console.error("getalllog: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`getalllog: Processing for SN ${sn}`);
    const data = await webSocketLoader.getAllLog(sn, stn, from, to);
    console.log("getalllog: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("getalllog Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/cleanlog", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("cleanlog: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`cleanlog: Processing for SN ${sn}`);
    const data = await webSocketLoader.cleanLog(sn);
    console.log("cleanlog: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("cleanlog Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقاط النهاية الخاصة بدوال الجهاز ***********
appAPI.post("/api/initsys", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("initsys: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`initsys: Processing for SN ${sn}`);
    const data = await webSocketLoader.initSys(sn);
    console.log("initsys: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("initsys Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/cleanadmin", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("cleanadmin: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`cleanadmin: Processing for SN ${sn}`);
    const data = await webSocketLoader.cleanAdmin(sn);
    console.log("cleanadmin: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("cleanadmin Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/setdevinfo", async (req, res) => {
  const { sn, devInfo } = req.body;
  if (!sn || !devInfo) {
    console.error("setdevinfo: SN and devInfo are required");
    return res.status(400).json({ error: "SN and devInfo are required" });
  }
  try {
    console.log(`setdevinfo: Processing for SN ${sn}`);
    const data = await webSocketLoader.setDevInfo(sn, devInfo);
    console.log("setdevinfo: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("setdevinfo Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/getdevinfo", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("getdevinfo: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`getdevinfo: Processing for SN ${sn}`);
    const data = await webSocketLoader.getDevInfo(sn);
    console.log("getdevinfo: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("getdevinfo Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/opendoor", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("opendoor: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`opendoor: Processing for SN ${sn}`);
    const data = await webSocketLoader.openDoor(sn);
    console.log("opendoor: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("opendoor Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقاط النهاية للدوال الجديدة ***********
appAPI.post("/api/setdevlock", async (req, res) => {
  const { sn, devLockInfo } = req.body;
  if (!sn || !devLockInfo) {
    console.error("setdevlock: SN and devLockInfo are required");
    return res.status(400).json({ error: "SN and devLockInfo are required" });
  }
  try {
    console.log(`setdevlock: Processing for SN ${sn}`);
    const data = await webSocketLoader.setDevLock(sn, devLockInfo);
    console.log("setdevlock: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("setdevlock Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/getdevlock", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("getdevlock: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`getdevlock: Processing for SN ${sn}`);
    const data = await webSocketLoader.getDevLock(sn);
    console.log("getdevlock: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("getdevlock Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/getuserlock", async (req, res) => {
  const { sn, enrollid } = req.body;
  if (!sn || enrollid === undefined) {
    console.error("getuserlock: SN and enrollid are required");
    return res.status(400).json({ error: "SN and enrollid are required" });
  }
  try {
    console.log(`getuserlock: Processing for SN ${sn}`);
    const data = await webSocketLoader.getUserLock(sn, enrollid);
    console.log("getuserlock: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("getuserlock Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/setuserlock", async (req, res) => {
  const { sn, userLockInfo } = req.body;
  if (!sn || !userLockInfo) {
    console.error("setuserlock: SN and userLockInfo are required");
    return res.status(400).json({ error: "SN and userLockInfo are required" });
  }
  try {
    console.log(`setuserlock: Processing for SN ${sn}`);
    const data = await webSocketLoader.setUserLock(sn, userLockInfo);
    console.log("setuserlock: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("setuserlock Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/deleteuserlock", async (req, res) => {
  const { sn, enrollid } = req.body;
  if (!sn || enrollid === undefined) {
    console.error("deleteuserlock: SN and enrollid are required");
    return res.status(400).json({ error: "SN and enrollid are required" });
  }
  try {
    console.log(`deleteuserlock: Processing for SN ${sn}`);
    const data = await webSocketLoader.deleteUserLock(sn, enrollid);
    console.log("deleteuserlock: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("deleteuserlock Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/cleanuserlock", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("cleanuserlock: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`cleanuserlock: Processing for SN ${sn}`);
    const data = await webSocketLoader.cleanUserLock(sn);
    console.log("cleanuserlock: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("cleanuserlock Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/disabledevice", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("disabledevice: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`disabledevice: Processing for SN ${sn}`);
    const data = await webSocketLoader.disableDevice(sn);
    console.log("disabledevice: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("disabledevice Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/enabledevice", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("enabledevice: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`enabledevice: Processing for SN ${sn}`);
    const data = await webSocketLoader.enableDevice(sn);
    console.log("enabledevice: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("enabledevice Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقاط النهاية الخاصة بالعطلات ***********
appAPI.post("/api/getholiday", async (req, res) => {
  const { sn, index } = req.body;
  if (!sn) {
    console.error("getholiday: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`getholiday: Processing for SN ${sn}`);
    const data = await webSocketLoader.getHoliday(sn, index);
    console.log("getholiday: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("getholiday Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/setholiday", async (req, res) => {
  const { sn, holidayInfo } = req.body;
  if (!sn || !holidayInfo) {
    console.error("setholiday: SN and holidayInfo are required");
    return res.status(400).json({ error: "SN and holidayInfo are required" });
  }
  try {
    console.log(`setholiday: Processing for SN ${sn}`);
    const data = await webSocketLoader.setHoliday(sn, holidayInfo);
    console.log("setholiday: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("setholiday Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/deleteholiday", async (req, res) => {
  const { sn, index } = req.body;
  if (!sn || index === undefined) {
    console.error("deleteholiday: SN and index are required");
    return res.status(400).json({ error: "SN and index are required" });
  }
  try {
    console.log(`deleteholiday: Processing for SN ${sn}`);
    const data = await webSocketLoader.deleteHoliday(sn, index);
    console.log("deleteholiday: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("deleteholiday Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/cleanholiday", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("cleanholiday: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`cleanholiday: Processing for SN ${sn}`);
    const data = await webSocketLoader.cleanHoliday(sn);
    console.log("cleanholiday: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("cleanholiday Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقاط النهاية الخاصة بمعلومات الجهاز ***********
appAPI.post("/api/getdeviceinfo", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("getdeviceinfo: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`getdeviceinfo: Processing for SN ${sn}`);
    const data = await webSocketLoader.getDeviceInfo(sn);
    console.log("getdeviceinfo: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("getdeviceinfo Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/getdeviceinfo-v2", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("getdeviceinfo-v2: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`getdeviceinfo-v2: Processing for SN ${sn}`);
    const data = await webSocketLoader.getDeviceInfoV2(sn);
    console.log("getdeviceinfo-v2: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("getdeviceinfo-v2 Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقطة النهاية: getreport ***********
appAPI.post("/api/getreport", async (req, res) => {
  const { sn, reportInfo } = req.body;
  if (!sn || !reportInfo) {
    console.error("getreport: SN and reportInfo are required");
    return res.status(400).json({ error: "SN and reportInfo are required" });
  }
  try {
    console.log(`getreport: Processing for SN ${sn}`);
    const data = await webSocketLoader.getReport(sn, reportInfo);
    console.log("getreport: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("getreport Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقاط النهاية لإضافة المستخدمين ***********
appAPI.post("/api/adduser-card", async (req, res) => {
  const { sn, enrollId } = req.body;
  if (!sn || !enrollId) {
    console.error("adduser-card: SN and enrollId are required");
    return res.status(400).json({ error: "SN and enrollId are required" });
  }
  try {
    console.log(`adduser-card: Processing for SN ${sn}`);
    const data = await webSocketLoader.addUserWithCard(sn, enrollId);
    console.log("adduser-card: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("adduser-card Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/adduserinfo", async (req, res) => {
  const { sn, userInfo } = req.body;
  if (!sn || !userInfo) {
    console.error("adduserinfo: SN and userInfo are required");
    return res.status(400).json({ error: "SN and userInfo are required" });
  }
  try {
    console.log(`adduserinfo: Processing for SN ${sn}`);
    const data = await webSocketLoader.addUserInfo(sn, userInfo);
    console.log("adduserinfo: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("adduserinfo Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقاط النهاية للوقت ***********
appAPI.post("/api/gettime", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("gettime: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`gettime: Processing for SN ${sn}`);
    const data = await webSocketLoader.getTime(sn);
    console.log("gettime: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("gettime Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/settime", async (req, res) => {
  const { sn, time } = req.body;
  if (!sn || !time) {
    console.error("settime: SN and Time are required");
    return res.status(400).json({ error: "SN and Time are required" });
  }
  try {
    console.log(`settime: Processing for SN ${sn}`);
    const data = await webSocketLoader.setTime(sn, time);
    console.log("settime: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("settime Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقاط النهاية لحالة الجهاز ***********
appAPI.post("/api/status", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("status: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`status: Processing for SN ${sn}`);
    const data = await webSocketLoader.getStatus(sn);
    console.log("status: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("status Error:", error);
    res.status(500).json({ error: error.message });
  }
});

appAPI.post("/api/reboot", async (req, res) => {
  const { sn } = req.body;
  if (!sn) {
    console.error("reboot: SN is required");
    return res.status(400).json({ error: "SN is required" });
  }
  try {
    console.log(`reboot: Processing for SN ${sn}`);
    const data = await webSocketLoader.reboot(sn);
    console.log("reboot: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("reboot Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// *********** نقطة النهاية للأحداث الديناميكية ***********
appAPI.post("/api/dynamic", async (req, res) => {
  const { sn, payload } = req.body;
  if (!sn || !payload) {
    console.error("dynamic: SN and payload are required");
    return res.status(400).json({ error: "SN and payload are required" });
  }
  try {
    console.log(`dynamic: Processing for SN ${sn}`);
    const data = await webSocketLoader.dynamicEvent(sn, payload);
    console.log("dynamic: Success", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("dynamic Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// بدء تشغيل خادم API على بورت مختلف
appAPI.listen(apiPort, () => {
  console.log(`API server started on port ${apiPort}`);
});
