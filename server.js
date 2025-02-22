// server.js (مقتطف)
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const connectDB = require("./config/db");
const { authMiddleware } = require("./auth");
const userRoutes = require("./routes/userRoutes");

// نستدعي بقية المسارات

const departmentRoutes = require("./routes/departmentRoutes");
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
const reportRoutes = require("./routes/reportRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const weekScheduleTemplatesRoutes = require("./routes/weekScheduleTemplatesRoutes");

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
connectDB();

app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

// مسارات المستخدم (تسجيل / دخول)
app.use("/api/users", userRoutes);

// بقية المسارات
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/departments", authMiddleware, departmentRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/fingerprints", fingerPrintLogRoutes);
app.use("/api/rewards-penalties", authMiddleware, rewardsAndPenaltiesRoutes);
app.use("/api/time-based-leaves", authMiddleware, timeBasedLeaveRoutes);
app.use("/api/requests", authMiddleware, apiRequestRoutes);
app.use("/api/attend-reports", authMiddleware, attendReportRoutes);
app.use("/api/attendance-designs", attendanceDesignRoutes);
app.use("/api/device-employees", authMiddleware, deviceEmployeeRoutes);
app.use("/api/official-holidays", authMiddleware, officialHolidayRoutes);
app.use("/api/pdf-designs", pdfDesignRoutes);
app.use("/api/status-names", statusNameRoutes);
app.use("/api/vacation-types", vacationTypeRoutes);
app.use("/api/vacations", vacationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/devices", authMiddleware, deviceRoutes);
app.use(
  "/api/weekSchedule-templates",
  authMiddleware,
  weekScheduleTemplatesRoutes
);

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// error handler
app.use(function (err, req, res, next) {
  // render the error page
  res.status(err.status || 500);
  res.json({ message: err.message, stack: err.stack });
});

//start server
const PORT =
  process.env.TYPE == "DEV" ? process.env.PORT_LOCAL : process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
