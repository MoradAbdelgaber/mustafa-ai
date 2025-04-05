// controllers/reportController.js

const moment = require("moment-timezone");
const FlexibleAggregateRule = require("../models/FlexibleAggregateRule");
const Employee = require("../models/Employee");
const FingerPrintLog = require("../models/FingerPrintLog");
const RewardsAndPenalties = require("../models/RewardsAndPenalties");
const OfficialHoliday = require("../models/OfficialHoliday");
const Vacation = require("../models/Vacation");
const VacationType = require("../models/VacationType");
const TimeBasedLeave = require("../models/TimeBasedLeave");
const StatusName = require("../models/StatusName");
const Activition = require('../models/Activition');
const { ObjectId } = require("mongoose").Types;
const axios = require('axios');
const Department = require("../models/Department");
const jwt = require("jsonwebtoken");
const jose = require("node-jose");
const crypto = require("crypto");

// استدعاء الكولكشن الخاص بقواعد المستخدم
const Rule = require("../models/Rule");
const { applyRulesToRecord } = require("../services/ruleEngine");

// استدعاء قواعد التجميع المرنة
const { applyFlexibleAggregateRules } = require("../services/flexibleAggregateRules");

// استدعاء كولكشن الدقائق الإضافية
const ExtraMinutes = require("../models/ExtraMinutes");

// ================== إعدادات التشفير والترخيص (نفس الأصل) ==================
const SECRET_KEY = "iraqsoft";
const RAW_ENCRYPTION_KEY = "ops2020";

const derivedEncryptionKeyBuffer = crypto.createHash("sha256")
  .update(RAW_ENCRYPTION_KEY)
  .digest();

// إعداد مفتاح التشفير لمكتبة node-jose
const encryptionKeyPromise = jose.JWK.asKey(
  { kty: "oct", k: derivedEncryptionKeyBuffer.toString("base64") },
  "json"
);

/**
 * دالة للتحقق من صحة الترخيص (نفس الأصل تمامًا)
 */
const verifyLicense = async (activationToken, currentDomain) => {
  try {
    const key = await encryptionKeyPromise;
    const decryptedResult = await jose.JWE.createDecrypt(key).decrypt(activationToken);
    const decryptedToken = decryptedResult.payload.toString();
    const decodedPayload = jwt.verify(decryptedToken, SECRET_KEY, { algorithms: ["HS256"] });

    // التحقق من تطابق الدومين
    if (decodedPayload.domain !== currentDomain) {
      throw new Error("الدومين غير مطابق للترخيص");
    }

    // التحقق من عدد الأجهزة والموظفين
    const devices = Number(decodedPayload.allowedDevices);
    if (!devices || typeof devices !== "number" || devices <= 0) {
      throw new Error("عدد الأجهزة غير صحيح");
    }
    const employees = Number(decodedPayload.allowedEmployees);
    if (!employees || employees <= 0) {
      throw new Error("عدد الموظفين غير صحيح");
    }

    return decodedPayload;
  } catch (err) {
    throw new Error("فشل التحقق من الترخيص: " + err.message);
  }
};
// ==========================================================================


/**
 * دوال مساعدة لتحويل الوقت بين المنطقة الزمنية والـ UTC
 */
function generateDateRange(start, end) {
  let result = [];
  let current = new Date(start);
  while (current <= end) {
    result.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return result;
}

function localTimeToUTC(dateObj, localTimeStr, tz = "Asia/Baghdad") {
  const datePart = moment(dateObj).format("YYYY-MM-DD");
  const localFull = `${datePart} ${localTimeStr}`; // ex: "2025-02-03 09:00:00"
  const localMoment = moment.tz(localFull, "YYYY-MM-DD HH:mm:ss", tz);
  return localMoment.utc().toDate();
}

function utcToLocalString(dateUTC, tz = "Asia/Baghdad") {
  if (!dateUTC) return null;
  return moment(dateUTC).tz(tz).format("YYYY-MM-DD HH:mm:ss");
}


/**
 * دالة لحساب عدد أيام العمل المتوقعة في شهر معيّن مع تجاهل العطلات الرسمية
 * (استخدمناها في التقارير لحساب "expectedWorkingDays")
 */
function calculateExpectedWorkingDays(monthDate, employee, officialHolidays) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let expectedDays = 0;
  let current = new Date(firstDay);
  const dayNameMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  while (current <= lastDay) {
    if (employee.joining_date && current < new Date(employee.joining_date)) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    if (employee.leave_date && current > new Date(employee.leave_date)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // هل اليوم عطلة رسمية؟
    const currentStr = current.toISOString().split("T")[0];
    const isHoliday = officialHolidays.some((holiday) => {
      const holidayStr = new Date(holiday.holiday_date)
        .toISOString()
        .split("T")[0];
      return holidayStr === currentStr;
    });
    if (isHoliday) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // إذا كان الموظف يعمل بنظام الشفت
    if (employee.scheduleMode === "shift" && employee.shift_id && employee.shift_id.daysMap) {
      const shiftStart = moment(employee.shift_id.cycleStartDate).startOf("day");
      const diffDays = moment(current).startOf("day").diff(shiftStart, "days");
      const cycleLen = employee.shift_id.cycleLength || 1;
      const cycleDayIndex = ((diffDays % cycleLen) + cycleLen) % cycleLen;
      let dayMapObj = employee.shift_id.daysMap.find(
        (d) => d.dayIndex === cycleDayIndex
      );
      if (dayMapObj && dayMapObj.timeSlot) {
        const ts = dayMapObj.timeSlot;
        // إذا أوقات الدوام ليست "00:00:00" => يوم عمل
        if (ts.startTime !== "00:00:00" || ts.endTime !== "00:00:00") {
          expectedDays++;
        }
      }
    }
    // else: نظام WeekSchedules
    else if (employee.weekSchedules && employee.weekSchedules.length > 0) {
      const dayName = dayNameMap[current.getDay()];
      let schedule = employee.weekSchedules.find((ws) => ws.day === dayName);
      if (
        schedule &&
        !(schedule.startTime === "00:00:00" && schedule.endTime === "00:00:00")
      ) {
        expectedDays++;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return expectedDays;
}


/**
 * الدالة المطلوبة: تقرير حضور يعتمد على فترة زمنية مخصصة يحددها المستخدم
 * من خلال الهيدر أو الـ Query Params (مثلاً من الساعة 07:00 إلى 07:30).
 * 
 * الفكرة:
 *   - لو وجدنا بصمة للموظف في هذه النافذة الزمنية في اليوم => يعتبر حاضر
 *   - لو لم توجد بصمة => يعتبر غائب
 * 
 * ونحافظ على التعامل مع باقي الحالات (عطلات رسمية، إجازات يومية وجزئية، مكافآت/جزاءات، إلخ).
 */
exports.getCustomTimeAttendanceReport = async (req, res) => {
  try {
    // ---------------------------------------------
    // 1) التحقق من الترخيص بواسطة سجل Activition
    // ---------------------------------------------
    const activitionRecord = await Activition.findOne().sort({ createdAt: 1 });
    if (!activitionRecord) {
      return res.status(404).json({ error: "لم يتم العثور على بيانات التفعيل في قاعدة البيانات" });
    }
    const customerBarcode = activitionRecord.name;
    const tokenUrl = `http://4.2.2.235:3800/api/client/token/${customerBarcode}`;
    const tokenResponse = await axios.get(tokenUrl);
    const activationToken = tokenResponse.data.activationToken;
    if (!activationToken) {
      return res.status(500).json({ error: "فشل في جلب التوكن من الـ API" });
    }
    const currentDomain = req.headers.host;
    await verifyLicense(activationToken, currentDomain);
    // ---------------------------------------------

    // ---------------------------------------------
    // 2) جلب الباراميترات الأساسية من الـ Query أو من الهيدر
    // ---------------------------------------------
    let {
      start_date = "2025-02-01",
      end_date = "2025-02-05",
      employee_id = 0,
      department_id = 0,
      show_official_holidays = 1,
      show_weekly_off_days = 1,
      timeZone = "Asia/Baghdad",

      // فترة البصمة المطلوبة من الهيدر أو الكويري
      custom_start_time,
      custom_end_time,

      use_dynamic_hour_price = 0,
      roundvalue = 1,
      status_code,
    } = req.query;

    // في حال لم يصلنا من الـ Query, نجرب الهيدر (يمكنك تغيير الاسم حسب رغبتك)
    if (!custom_start_time) {
      custom_start_time = req.headers['custom-start-time'] || "07:00:00";
    }
    if (!custom_end_time) {
      custom_end_time = req.headers['custom-end-time'] || "07:30:00";
    }

    // إذا أنت تريد أن تكون الدقائق فقط بلا ثواني
    // ممكن تعديل الصيغة: "HH:mm" بدلاً من "HH:mm:ss"
    if (!custom_start_time.includes(":")) custom_start_time += ":00";
    if (custom_start_time.split(":").length === 2) custom_start_time += ":00";
    if (!custom_end_time.includes(":")) custom_end_time += ":00";
    if (custom_end_time.split(":").length === 2) custom_end_time += ":00";

    const useDynamicHourPrice = +use_dynamic_hour_price === 1;
    // إن كان الموظف الذي يطلب التقرير هو نفسه
    if (req.employee) {
      employee_id = req.employee.enroll_id;
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // ---------------------------------------------
    // 3) تجهيز فلاتر جلب الموظفين من Mongo
    // ---------------------------------------------
    const empMatch = {};
    if (employee_id && employee_id !== "0") {
      if (employee_id.includes(",")) {
        const employeeIds = employee_id.split(",").map(id => +id);
        empMatch.enroll_id = { $in: employeeIds };
      } else {
        empMatch.enroll_id = +employee_id;
      }
    }
    if (department_id && department_id !== "0") {
      empMatch.department_id = new ObjectId(department_id);
    }

    // فلترة حسب حقل tagemployee لو وصل من الهيدر
    const tagemployeeHeader = req.headers.tagemployee;
    if (tagemployeeHeader) {
      const tagsArray = tagemployeeHeader
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag !== "");
      if (tagsArray.length > 0) {
        empMatch.tagemployee = { $in: tagsArray.map(tag => new ObjectId(tag)) };
      }
    }

    // ---------------------------------------------
    // 4) جلب بيانات الموظفين
    // ---------------------------------------------
    const employees = await Employee.find({ ...empMatch, owner: req.userId })
      .populate("department_id", "department")
      .populate({
        path: "shift_id",
        populate: {
          path: "daysMap.timeSlot",
          model: "TimeSlot",
        },
      })
      .lean();

    // جميع الأيام في المدى الزمني
    let allDates = generateDateRange(startDate, endDate);

    // ---------------------------------------------
    // 5) جلب بصمات الأصابع في الفترة
    // ---------------------------------------------
    let fingerMatch = {
      time: { $gte: startDate, $lte: new Date(endDate.getTime() + 24 * 3600 * 1000) },
    };
    if (employee_id && employee_id !== "0") {
      if (employee_id.includes(",")) {
        const employeeIds = employee_id.split(",").map(id => +id);
        fingerMatch.enrollid = { $in: employeeIds };
      } else {
        fingerMatch.enrollid = +employee_id;
      }
    }
    const fingerLogs = await FingerPrintLog.find({
      ...fingerMatch,
      owner: req.userId,
    }).lean();

    // ---------------------------------------------
    // 6) جلب العطلات الرسمية
    // ---------------------------------------------
    let officialHolidays = [];
    if (+show_official_holidays === 1) {
      officialHolidays = await OfficialHoliday.find({
        holiday_date: { $gte: startDate, $lte: endDate },
        owner: req.userId,
      }).lean();
    }

    // ---------------------------------------------
    // 7) جلب الإجازات اليومية
    // ---------------------------------------------
    let vacMatch = {
      vacation_end_date: { $gte: startDate },
      vacation_start_date: { $lte: endDate },
    };
    if (+employee_id !== 0) vacMatch.enroll_id = +employee_id;

    const vacations = await Vacation.find({
      ...vacMatch,
      owner: req.userId,
    })
      .populate("vacation_type_id")
      .lean();

    // ---------------------------------------------
    // 8) جلب الإجازات الجزئية (TimeBasedLeaves)
    // ---------------------------------------------
    let tblMatch = {
      leave_date: { $gte: startDate, $lte: endDate },
    };
    if (employee_id && employee_id !== "0") {
      if (employee_id.includes(",")) {
        const employeeIds = employee_id.split(",").map(id => +id);
        tblMatch.enroll_id = { $in: employeeIds };
      } else {
        tblMatch.enroll_id = +employee_id;
      }
    }
    const timeBasedLeaves = await TimeBasedLeave.find({
      ...tblMatch,
      owner: req.userId,
    }).lean();

    // ---------------------------------------------
    // 9) جلب المكافآت والجزاءات
    // ---------------------------------------------
    let rpMatch = {
      date: { $gte: startDate, $lte: endDate },
    };
    if (+employee_id !== 0) rpMatch.enroll_id = +employee_id;
    const rpData = await RewardsAndPenalties.find({
      ...rpMatch,
      owner: req.userId,
    }).lean();

    // ---------------------------------------------
    // 10) جلب الدقائق الإضافية
    // ---------------------------------------------
    const extraMinutesData = await ExtraMinutes.find({
      owner: req.userId,
      bonus_date: { $gte: startDate, $lte: endDate },
    }).lean();

    // خارطة لتجميع الدقائق الإضافية
    let extraMinutesMap = {};
    for (let em of extraMinutesData) {
      let eId = em.enroll_id;
      let dateStr = new Date(em.bonus_date).toISOString().split("T")[0];
      if (!extraMinutesMap[eId]) extraMinutesMap[eId] = {};
      if (!extraMinutesMap[eId][dateStr]) extraMinutesMap[eId][dateStr] = 0;
      extraMinutesMap[eId][dateStr] += em.minutes;
    }

    // ---------------------------------------------
    // الدوال/الثوابت المساعدة
    // ---------------------------------------------
    const dayNameMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // ---------------------------------------------
    // 11) بدء بناء التقرير
    // ---------------------------------------------
    let finalResults = [];
    let sumRequiredWorkHours = 0;

    for (const emp of employees) {
      // حساب عدد أيام العمل الرسمية للموظف خلال الفترة (كما في التقارير السابقة)
      let empWorkingDays = 0;
      allDates.forEach((dateObj) => {
        if (emp.joining_date && dateObj < new Date(emp.joining_date)) return;
        if (emp.leave_date && dateObj > new Date(emp.leave_date)) return;
        let dayIndex = dateObj.getDay();
        let dayName = dayNameMap[dayIndex];

        // الشفت
        if (emp.scheduleMode === "shift" && emp.shift_id && emp.shift_id.daysMap) {
          const shiftStart = moment(emp.shift_id.cycleStartDate).startOf("day");
          const diffDays = moment(dateObj).startOf("day").diff(shiftStart, "days");
          const cycleLen = emp.shift_id.cycleLength || 1;
          const cycleDayIndex = ((diffDays % cycleLen) + cycleLen) % cycleLen;
          let dayMapObj = emp.shift_id.daysMap.find(
            (d) => d.dayIndex === cycleDayIndex
          );
          if (dayMapObj && dayMapObj.timeSlot) {
            let ts = dayMapObj.timeSlot;
            if (ts.startTime !== "00:00:00" || ts.endTime !== "00:00:00") {
              empWorkingDays++;
            }
          }
        }
        // weekSchedules
        else if (emp.weekSchedules && emp.weekSchedules.length > 0) {
          let schedule = emp.weekSchedules.find((ws) => ws.day === dayName);
          if (
            schedule &&
            !(schedule.startTime === "00:00:00" && schedule.endTime === "00:00:00")
          ) {
            empWorkingDays++;
          }
        }
      });

      // الآن نمر على كل يوم في الفترة
      for (const dateObj of allDates) {
        const dateStr = dateObj.toISOString().split("T")[0];

        // خارج فترة عمل الموظف
        if (emp.joining_date && dateObj < new Date(emp.joining_date)) continue;
        if (emp.leave_date && dateObj > new Date(emp.leave_date)) continue;

        let dayIndex = dateObj.getDay();
        let dayName = dayNameMap[dayIndex];

        // سنبني سجل التقرير (بدائي)
        let record = {
          enroll_id: emp.enroll_id,
          employee_name: emp.name,
          department_id: emp.department_id ? emp.department_id._id : null,
          department_name: emp.department,
          attendance_date: dateStr,
          day: dayName,

          // سنحسب لاحقًا
          status_code: "absent",
          attendance_status: "absent",
          check_in: null,
          check_out: null,
          work_hours: 0,
          base_work_hours: 0,
          total_rest_duration: 0,
          rest_breaks: [],
          // ...

          daily_salary: 0,
          hour_price: 0,
          overtime_price: 0,
          overtime_minutes: 0,
          delay_minutes: 0,
          early_exit_minutes: 0,

          rewards_penalties_amount: 0,
          net_salary: 0,
          net_salary_before_rounding: 0,

          dynamic_hour_price:
            emp.main_salary && empWorkingDays
              ? emp.main_salary / empWorkingDays / (8) // فقط مثال: 8 ساعات افتراضية
              : 0,
        };

        // ------ التحقق من العطلة الرسمية --------
        let holidayDoc = officialHolidays.find((h) => {
          let hDate = new Date(h.holiday_date).toISOString().split("T")[0];
          return hDate === dateStr;
        });
        if (holidayDoc) {
          record.status_code = "holiday";
          finalResults.push(record);
          continue;
        }

        // ------ التحقق من إجازة يومية -----------
        let foundVacation = vacations.find(
          (v) =>
            String(v.enroll_id) === String(emp.enroll_id) &&
            new Date(v.vacation_start_date) <= dateObj &&
            new Date(v.vacation_end_date) >= dateObj
        );
        if (foundVacation) {
          if (foundVacation.status === "Approved" && foundVacation.is_paid) {
            // إجازة مدفوعة
            record.status_code = foundVacation.vacation_type_id
              ? foundVacation.vacation_type_id.vacation_name || "إجازة مدفوعة"
              : "إجازة مدفوعة";
            record.is_vacation_day = true;
            record.is_paid_vacation = true;
            record.vacation_status = foundVacation.status;
            // (يمكن حساب رواتب الإجازة إن أردت)
            finalResults.push(record);
            continue;
          } else if (foundVacation.status === "Pending") {
            record.status_code = "أجازة انتظار";
            record.is_vacation_day = true;
            record.is_paid_vacation = !!foundVacation.is_paid;
            record.vacation_status = foundVacation.status;
          } else if (foundVacation.status === "Rejected") {
            // إجازة مرفوضة => نترك الحالة كما هي (absent أو سنرى البصمات)
            record.is_vacation_day = false;
            record.vacation_status = foundVacation.status;
          } else {
            // إجازة غير مدفوعة
            record.status_code = foundVacation.vacation_type_id
              ? foundVacation.vacation_type_id.vacation_name || "إجازة غير مدفوعة"
              : "إجازة غير مدفوعة";
            record.is_vacation_day = true;
            record.is_paid_vacation = !!foundVacation.is_paid;
            record.vacation_status = foundVacation.status;
            finalResults.push(record);
            continue;
          }
        }

        // ------ التحقق من بصمات الجزئية لليوم (TimeBasedLeave) ------
        let partial = timeBasedLeaves.find((tb) => {
          let tbDate = new Date(tb.leave_date).toISOString().split("T")[0];
          return (
            String(tb.enroll_id) === String(emp.enroll_id) &&
            tbDate === dateStr
          );
        });

        // ------ بناء وقت البدء والانتهاء اعتمادًا على custom_start_time / custom_end_time ------
        let customStartUTC = localTimeToUTC(dateObj, custom_start_time, timeZone);
        let customEndUTC = localTimeToUTC(dateObj, custom_end_time, timeZone);

        // إن كان هناك partial إجازة زمنية => نعدّل نافذة الوقت
        // على افتراض أننا نريد إضافة/طرح دقائق الإجازة من فترة "الدوام" المطلوبة
        // (مثال: لو لديه 10 دقائق إجازة جزئية في الدخول => نخصم 10 دقائق من وقت الدخول، فيصبح أبكر)
        // حتى يصبح "أكثر مرونة" في الحضور. أو بالعكس ممكن نجعلها لاحقًا. 
        // هنا سنفترض نفس المنطق كما في الدالة الأصلية:
        if (partial) {
          if (partial.leave_duration_for_entry) {
            customStartUTC = new Date(customStartUTC.getTime() - partial.leave_duration_for_entry * 60000);
          }
          if (partial.leave_duration_for_exit) {
            customEndUTC = new Date(customEndUTC.getTime() + partial.leave_duration_for_exit * 60000);
          }
          record.leave_duration_for_entry = partial.leave_duration_for_entry || 0;
          record.leave_duration_for_exit = partial.leave_duration_for_exit || 0;
        }

        // ------ فلترة البصمات لهذا الموظف في اليوم المحدد, ضمن الفترة [customStartUTC..customEndUTC] ------
        let dayFingerLogs = fingerLogs
          .filter((f) => {
            if (String(f.enrollid) !== String(emp.enroll_id)) return false;
            let fTime = new Date(f.time);
            return (fTime >= customStartUTC && fTime <= customEndUTC);
          })
          .sort((a, b) => new Date(a.time) - new Date(b.time));

        // إن وجدنا بصمات => حضور، وإلا => غياب
        if (dayFingerLogs.length > 0) {
          record.status_code = "present";
          // check_in = أول بصمة في هذه الفترة، check_out = آخر بصمة
          record.check_in = utcToLocalString(dayFingerLogs[0].time, timeZone);
          record.check_out = utcToLocalString(dayFingerLogs[dayFingerLogs.length - 1].time, timeZone);
          // يمكن اعتبار work_hours = الفرق بين أول وآخر بصمة (إن أردت)
          let diffHours = (dayFingerLogs[dayFingerLogs.length - 1].time - dayFingerLogs[0].time) / 3600000;
          if (diffHours < 0) diffHours = 0;
          record.work_hours = +diffHours.toFixed(2);
          record.base_work_hours = record.work_hours;
        } else {
          record.status_code = "absent";
        }

        // ------ إضافة الدقائق الإضافية ------
        let extraMins = 0;
        if (extraMinutesMap[emp.enroll_id] && extraMinutesMap[emp.enroll_id][dateStr]) {
          extraMins = extraMinutesMap[emp.enroll_id][dateStr];
        }
        record.extra_minutes = extraMins;
        if (record.status_code === "present") {
          record.work_hours += extraMins / 60;
        }

        // ------ مكافآت/جزاءات في هذا اليوم ------
        let rpItems = rpData.filter((r) => {
          let rDate = new Date(r.date).toISOString().split("T")[0];
          return (
            String(r.enroll_id) === String(emp.enroll_id) && rDate === dateStr
          );
        });
        let rpAmount = rpItems.reduce((sum, r) => sum + (r.amount || 0), 0);
        record.rewards_penalties_amount = rpAmount;

        // ------ حساب الراتب بناءً على يومية أو ساعية أو خلافه (إن أردت) ------
        // في هذا المثال: إن كان حاضر => نعطيه أجر الساعات × سعر الساعة
        // أو (dailyWage) إن أردت. (هنا نوضح ببساطة)
        if (record.status_code === "present") {
          // هل نستخدم hour_price ديناميكي؟
          const hourPrice = useDynamicHourPrice
            ? record.dynamic_hour_price
            : (emp.hour_price || 0);

          let rawSalary = record.work_hours * hourPrice;
          let roundedSalary = Math.round(rawSalary / roundvalue) * roundvalue;
          record.salary_earned_for_work = roundedSalary;
        } else {
          record.salary_earned_for_work = 0;
        }

        // يمكن إضافة أي حسميات/ إضافات أخرى كما تريد
        let netVal = (record.salary_earned_for_work || 0) + (record.rewards_penalties_amount || 0);
        record.net_salary_before_rounding = netVal;
        record.net_salary = netVal;

        // إن لم تكن عطلة رسمية أو راحة كاملة، نزيد ساعات العمل المطلوبة
        if (record.status_code !== "holiday") {
          // يمكنك أن تحددها بقيمة ثابته (مثلا 8) أو من جدول آخر
          sumRequiredWorkHours += 8;
        }

        finalResults.push(record);
      }
    }

    // ---------------------------------------------
    // 12) ترتيب النتائج
    // ---------------------------------------------
    finalResults.sort((a, b) => {
      let d1 = (a.attendance_date || "").localeCompare(b.attendance_date || "");
      if (d1 !== 0) return d1;
      return (a.employee_name || "").localeCompare(b.employee_name || "");
    });

    // ---------------------------------------------
    // 13) تعريب الـ status_code إن وجد في كولكشن StatusName
    // ---------------------------------------------
    for (let r of finalResults) {
      if (!r.status_code) continue;
      let stDoc = await StatusName.findOne({
        status_code: r.status_code,
      }).lean();
      if (stDoc) {
        r.attendance_status = stDoc.status_name;
      } else {
        r.attendance_status = r.status_code;
      }
    }

    // ---------------------------------------------
    // 14) تطبيق قواعد المستخدم (Rule)
    // ---------------------------------------------
    const userRules = await Rule.find({ owner: req.userId }).lean();
    for (let i = 0; i < finalResults.length; i++) {
      finalResults[i] = applyRulesToRecord(finalResults[i], userRules);

      // إعادة حساب net_salary بعد تعديل القواعد
      let rec = finalResults[i];
      let netVal =
        (rec.salary_earned_for_work || 0) +
        (rec.overtime_entitlement || 0) - // إن كان هناك أوفر تايم
        (rec.rest_cutting || 0) -
        (rec.late_arrival_deduction || 0) -
        (rec.early_exit_deduction || 0) -
        (rec.absent_cutting || 0) -
        (rec.late_cutting_by_count || 0) -
        (rec.early_cutting_by_count || 0) +
        (rec.rewards_penalties_amount || 0);

      rec.net_salary_before_rounding = netVal;
      rec.net_salary = netVal;
    }

    // ---------------------------------------------
    // 15) فلترة حسب باراميتر status_code (إن وجد)
    // ---------------------------------------------
    if (status_code) {
      finalResults = finalResults.filter((r) => r.status_code === status_code);
    }

    // ---------------------------------------------
    // 16) بناء صف مختصر في النهاية (summaryRow)
    //    لجمع بعض الإحصاءات مثل عدد الغيابات... إلخ
    // ---------------------------------------------
    let sumDelayMinutes = 0,
      sumEarlyExitMinutes = 0,
      lateCount = 0,
      earlyExitCount = 0,
      sumOT = 0,
      sumAbs = 0,
      sumRewards = 0,
      sumPenalties = 0,
      sumNet = 0,
      sumTotalRestDuration = 0,
      sumBaseWork = 0,
      countPaidLeaves = 0,
      countUnpaidLeaves = 0,
      countPendingLeaves = 0,
      countTimeBasedLeaves = 0,
      sumEntryLeaveMins = 0,
      sumExitLeaveMins = 0,
      officialHolidayCount = 0,
      restDayCount = 0,
      workingDayCount = 0,
      week_work_offcount = 0;

    for (let r of finalResults) {
      sumDelayMinutes += r.delay_minutes || 0;
      sumEarlyExitMinutes += r.early_exit_minutes || 0;
      if ((r.delay_minutes || 0) > 0) lateCount++;
      if ((r.early_exit_minutes || 0) > 0) earlyExitCount++;
      sumOT += r.overtime_minutes || 0;
      if (r.status_code === "absent") sumAbs++;
      if (r.status_code === "holiday") officialHolidayCount++;
      else if (r.status_code === "week_work_off") week_work_offcount++;
      else if (
        r.status_code === "work_off" ||
        r.status_code === "أستراحة" ||
        r.status_code === "rest_day"
      ) {
        restDayCount++;
      } else {
        workingDayCount++;
      }
      let rpAmt = r.rewards_penalties_amount || 0;
      if (rpAmt > 0) sumRewards += rpAmt;
      else if (rpAmt < 0) sumPenalties += rpAmt;
      sumNet += r.net_salary || 0;
      sumTotalRestDuration += r.total_rest_duration || 0;
      sumBaseWork += r.base_work_hours || 0;

      if (r.is_vacation_day) {
        if (r.vacation_status === "Approved") {
          if (r.is_paid_vacation) countPaidLeaves++;
          else countUnpaidLeaves++;
        } else if (r.vacation_status === "Pending") {
          countPendingLeaves++;
        }
      }
      let eM = r.leave_duration_for_entry || 0;
      let xM = r.leave_duration_for_exit || 0;
      if (eM > 0 || xM > 0) countTimeBasedLeaves++;
      sumEntryLeaveMins += eM;
      sumExitLeaveMins += xM;
    }
    let sumRP = sumRewards + sumPenalties;

    // (اختر أي تاريخ من الفترة لحساب expectedWorkDays)
    const reportMonthDate = new Date(start_date);
    const firstEmployee = employees[0] || {};
    const expectedWorkDays = calculateExpectedWorkingDays(
      reportMonthDate,
      firstEmployee,
      officialHolidays
    );

    let summaryRow = {
      enroll_id: null,
      employee_name:
        `--- المُلخص ---` +
        ` | دقائق التأخير=${sumDelayMinutes}` +
        ` | دقائق الخروج المبكر=${sumEarlyExitMinutes}` +
        ` | مرات التاخير=${lateCount}` +
        ` | مرات الخروج المبكر=${earlyExitCount}` +
        ` | دقائق الأوفر تايم=${sumOT}` +
        ` | الغياب=${sumAbs}` +
        ` | المكافآت=${sumRewards}` +
        ` | عقوبات=${sumPenalties}` +
        ` | مجموع المكافآت والعقوبات=${sumRP}` +
        ` | صافي=${Number(sumNet).toFixed(2)}` +
        ` | الاستراحة(ساعة)=${sumTotalRestDuration.toFixed(2)}` +
        ` | العمل الاساسي=${sumBaseWork.toFixed(2)}` +
        ` | إجازات مدفوعة=${countPaidLeaves}` +
        ` | إجازات غير مدفوعة=${countUnpaidLeaves}` +
        ` | إجازات انتظار=${countPendingLeaves}` +
        ` | إجازات زمنية=${countTimeBasedLeaves}` +
        ` | دقائق اجازات زمنية دخول=${sumEntryLeaveMins}` +
        ` | دقائق اجازات زمنية خروج=${sumExitLeaveMins}` +
        ` | عطل رسمية=${officialHolidayCount}` +
        ` | ايام استراحة=${restDayCount}` +
        ` | ايام عمل=${workingDayCount}` +
        ` | عطل اسبوعية=${week_work_offcount}` +
        ` | ساعات العمل المطلوبة=${sumRequiredWorkHours}` +
        ` | أيام الدوام المتوقعة=${expectedWorkDays}`,
      attendance_date: null,
      day: null,
      check_in: null,
      check_out: null,
      rest_breaks: null,
      total_rest_duration: null,
      delay_minutes: null,
      early_exit_minutes: null,
      overtime_minutes: null,
      status_code: null,
      attendance_status: "-- SUMMARY --",
      work_hours: null,
      daily_salary: null,
      hour_price: null,
      overtime_price: null,
      works_for_daily_wage: null,
      official_working_hours: null,
      minimum_working_hours_overtime: null,
      salary_earned_for_work: null,
      overtime_entitlement: null,
      late_cutting_by_count: null,
      early_cutting_by_count: null,
      absent_cutting: null,
      late_arrival_deduction: null,
      early_exit_deduction: null,
      rewards_penalties_amount: null,
      net_salary_before_rounding: null,
      net_salary: null,
    };

    finalResults.push(summaryRow);

    // ---------------------------------------------
    // 17) تطبيق قواعد التجميع المرنة - (إن كنت تستخدمها)
    // ---------------------------------------------
    finalResults = await applyFlexibleAggregateRules(finalResults, {
      ownerId: req.userId,
      reportStartDate: startDate,
      reportEndDate: endDate,
      timeZone
    });

    return res.json(finalResults);
  } catch (err) {
    console.error("Error in getCustomTimeAttendanceReport:", err.message);
    return res.status(500).json({ error: "حدث خطأ أثناء توليد التقرير", details: err.message });
  }
};
