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
const Activition = require("../models/Activition");
const { ObjectId } = require("mongoose").Types;
const axios = require("axios");
const Department = require("../models/Department");
const jwt = require("jsonwebtoken");
const jose = require("node-jose");
const crypto = require("crypto");

// ------------- إضافة الاستدعاءات لمحرك القواعد -------------
const Rule = require("../models/Rule");
const { applyRulesToRecord } = require("../services/ruleEngine");
const {
  applyFlexibleAggregateRules,
} = require("../services/flexibleAggregateRules");
// -----------------------------------------------------------

// ------------- استدعاء كولكشن الدقائق الإضافية -------------
const ExtraMinutes = require("../models/ExtraMinutes");
// -----------------------------------------------------------

// المفتاح السري لتوقيع JWT
const SECRET_KEY = "iraqsoft";
// المفتاح الأصلي للتشفير
const RAW_ENCRYPTION_KEY = "ops2020";

// تحويل المفتاح إلى 256-بت باستخدام SHA-256
const derivedEncryptionKeyBuffer = crypto
  .createHash("sha256")
  .update(RAW_ENCRYPTION_KEY)
  .digest();

// إعداد مفتاح التشفير لمكتبة node‑jose بتنسيق JSON المناسب
const encryptionKeyPromise = jose.JWK.asKey(
  { kty: "oct", k: derivedEncryptionKeyBuffer.toString("base64") },
  "json"
);

/**
 * دالة verifyLicense تقوم بـ:
 * - فك تشفير التوكن المشفر باستخدام node‑jose.
 * - التحقق من صحة توقيع JWT باستخدام المفتاح السري.
 * - التأكد من تطابق الدومين وعدد الأجهزة والموظفين.
 *
 * @param {string} activationToken - التوكن المشفر.
 * @param {string} currentDomain - الدومين الحالي للتحقق منه.
 * @returns {object} - الحمولة المفكوكة من التوكين.
 */
const verifyLicense = async (activationToken, currentDomain) => {
  try {
    // الحصول على مفتاح التشفير
    const key = await encryptionKeyPromise;
    // فك تشفير التوكن باستخدام node‑jose
    const decryptedResult = await jose.JWE.createDecrypt(key).decrypt(
      activationToken
    );
    const decryptedToken = decryptedResult.payload.toString();
    // التحقق من صحة توقيع JWT باستخدام المفتاح السري
    const decodedPayload = jwt.verify(decryptedToken, SECRET_KEY, {
      algorithms: ["HS256"],
    });

    // التحقق من تطابق الدومين
    if (decodedPayload.domain !== currentDomain) {
      throw new Error("الدومين غير مطابق");
    }

    // التحقق من عدد الأجهزة والموظفين (يجب أن تكون القيم أرقام وأكبر من 0)
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

/** توليد قائمة تواريخ من startDate إلى endDate */
function generateDateRange(start, end) {
  let result = [];
  let current = new Date(start);
  while (current <= end) {
    result.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return result;
}

/**
 * تحويل وقت محلّي (HH:MM:SS) في يوم dateObj إلى UTC باستخدام moment-timezone
 * @param {Date} dateObj تاريخ اليوم (أول اليوم) بشكل UTC
 * @param {string} localTimeStr مثل "09:00:00"
 * @param {string} tz اسم المنطقة الزمنية مثل "Asia/Baghdad"
 * @returns {Date} وقت UTC
 */
function localTimeToUTC(dateObj, localTimeStr, tz = "Asia/Baghdad") {
  const datePart = moment(dateObj).format("YYYY-MM-DD");
  const localFull = `${datePart} ${localTimeStr}`; // ex: "2025-02-03 09:00:00"
  const localMoment = moment.tz(localFull, "YYYY-MM-DD HH:mm:ss", tz);
  return localMoment.utc().toDate();
}

/** تحويل تاريخ UTC => نص وقت محلّي */
function utcToLocalString(dateUTC, tz = "Asia/Baghdad") {
  if (!dateUTC) return null;
  return moment(dateUTC).tz(tz).format("YYYY-MM-DD HH:mm:ss");
}

/** جمع الاستراحات (event=3 => event=4) */
function matchMultipleBreaks(e3, e4) {
  let restBreaks = [];
  let j = 0;
  for (let i = 0; i < e3.length; i++) {
    let rIn = new Date(e3[i].time); // وقت دخول الاستراحة (event=3)
    while (j < e4.length) {
      let rOut = new Date(e4[j].time); // وقت خروج الاستراحة (event=4)
      if (rOut >= rIn) {
        let dur = (rOut - rIn) / (1000 * 3600);
        if (dur < 0) dur = 0;
        restBreaks.push({
          rest_in: rIn,
          rest_out: rOut,
          duration: dur,
        });
        j++;
        break;
      }
      j++;
    }
  }
  return restBreaks;
}

/**
 * الدالة الرئيسية لحساب التأخير وخروج مبكر (نظام قديم: اعتماد بصمة دخول واحدة وخروج واحدة)
 * وفيها:
 *   - إن !overtime_eligible && وقت الدخول قبل startTime => نعرضه startTime
 *   - إن !overtime_eligible && وقت الخروج يجب أن يقع بين first_exit_allowed_time و last_exit_allowed_time
 */
function calculateAttendanceMetrics({
  checkInUTC,
  checkOutUTC,
  restBreaks,
  daySchedule,
  dayStartUTC,
  dayEndUTC,
  workRegStartUTC,
  firstExitUTC,
  lastExitUTC,
  lastEntryPreventionUTC,
  overtimeStartUTC,
}) {
  let delayMinutes = 0,
    earlyExitMinutes = 0,
    overtimeMinutes = 0;
  let statusCode = "absent";
  let workHours = 0;

  // وقت الدخول والخروج الفعلي (قبل أي تعديل)
  let actualCheckIn = checkInUTC ? new Date(checkInUTC) : null;
  let actualCheckOut = checkOutUTC ? new Date(checkOutUTC) : null;

  // لو عندنا work_registration_start_time => بصمة قبلها = null
  if (actualCheckIn && workRegStartUTC && actualCheckIn < workRegStartUTC) {
    actualCheckIn = null; // تهمل
  }
  // لو كان بعد حد المنع lastEntryPreventionUTC => تهمل أيضًا
  if (
    actualCheckIn &&
    lastEntryPreventionUTC &&
    actualCheckIn > lastEntryPreventionUTC
  ) {
    actualCheckIn = null; // تهمل
  }

  // ### التعامل مع وقت الدخول ###
  if (!daySchedule.overtime_eligible && actualCheckIn) {
    // لو الموظف جاء قبل startTime, لكن >= workRegStartUTC => نعرضه startTime
    if (
      actualCheckIn < dayStartUTC &&
      (!workRegStartUTC || actualCheckIn >= workRegStartUTC)
    ) {
      actualCheckIn = dayStartUTC;
    }
  }

  // ### التعامل مع وقت الخروج ###
  if (actualCheckOut) {
    if (!daySchedule.overtime_eligible && actualCheckOut > dayEndUTC) {
      console.log(
        "الموظف غير مؤهل للأوفر تايم، يتم تعيين وقت الخروج إلى نهاية اليوم:",
        dayEndUTC
      );
      actualCheckOut = dayEndUTC;
    } else if (daySchedule.overtime_eligible) {
      console.log(
        "الموظف مؤهل للأوفر تايم، وقت الخروج يُستخدم كما هو:",
        actualCheckOut
      );
    }

    if (firstExitUTC && actualCheckOut < firstExitUTC) {
      console.log("وقت الخروج أقل من firstExitUTC، يتم تعيينه إلى null");
      actualCheckOut = null;
    }
    if (lastExitUTC && actualCheckOut > lastExitUTC) {
      console.log("وقت الخروج أكبر من lastExitUTC، يتم تعيينه إلى null");
      actualCheckOut = null;
    }

    if (firstExitUTC && actualCheckOut < firstExitUTC) {
      actualCheckOut = null;
    }
    if (lastExitUTC && actualCheckOut > lastExitUTC) {
      actualCheckOut = null;
    }
  }

  // لحساب ساعات العمل الأساسية قبل طرح الاستراحات
  let baseWork = 0;
  if (actualCheckIn && actualCheckOut) {
    baseWork = (actualCheckOut - actualCheckIn) / (1000 * 3600);
    if (baseWork < 0) baseWork = 0;
  }
  // طرح الاستراحات
  let totalRest = 0;
  for (let b of restBreaks) {
    let dur = (b.rest_out - b.rest_in) / (1000 * 3600);
    if (dur < 0) dur = 0;
    totalRest += dur;
  }
  let finalWorkHours = 0;
  if (baseWork > 0) {
    finalWorkHours =
      baseWork - totalRest + (daySchedule.allowed_min_rest || 0) / 60;
  } else {
    finalWorkHours = baseWork; // أو تهيئها إلى 0 كما هو مناسب
  }

  // إن كان الموظف مؤهلًا للأوفر تايم
  if (daySchedule.overtime_eligible) {
    let otHours = finalWorkHours - (daySchedule.official_working_hours || 8);
    if (otHours > 0) {
      if (
        daySchedule.minimum_working_hours_overtime &&
        finalWorkHours < daySchedule.minimum_working_hours_overtime
      ) {
        overtimeMinutes = 0;
      } else {
        if (overtimeStartUTC && actualCheckOut < overtimeStartUTC) {
          overtimeMinutes = 0;
        } else {
          overtimeMinutes = otHours * 60; // تحويل الساعات إلى دقائق
        }
      }
    }
  }

  if (finalWorkHours < 0) finalWorkHours = 0;

  if (!daySchedule.overtime_eligible) {
    const addDelayHours = (daySchedule.allowed_delay_minutes || 0) / 60;
    const subExitHours = (daySchedule.allowed_exit_minutes || 0) / 60;
    const officialHours = daySchedule.official_working_hours || 8;
    if (finalWorkHours + addDelayHours >= officialHours - subExitHours) {
      finalWorkHours = officialHours;
    }
  }

  // حساب التأخير
  let dmins = 0;
  if (actualCheckIn && actualCheckIn > dayStartUTC) {
    let diff = (actualCheckIn - dayStartUTC) / 60000;
    let dm = Math.round(diff);
    if (
      daySchedule.allowed_delay_minutes &&
      dm <= daySchedule.allowed_delay_minutes
    ) {
      dm = 0;
    }
    dmins = dm;
  }

  // حساب الخروج المبكر
  let emins = 0;
  if (
    actualCheckOut &&
    actualCheckOut < dayEndUTC &&
    finalWorkHours < (daySchedule.official_working_hours || 8)
  ) {
    let diffE = (dayEndUTC - actualCheckOut) / 60000;
    let e2 = Math.round(diffE);
    if (
      daySchedule.allowed_exit_minutes &&
      e2 <= daySchedule.allowed_exit_minutes
    ) {
      e2 = 0;
    }
    emins = e2;
  }

  // الحالة

  let finalStatus = "absent";

  if (actualCheckIn && !actualCheckOut) {
    const currentUTC = new Date();

    // إذا تجاوز الوقت الحالي آخر وقت مسموح به لتسجيل الخروج يكون "half_day"
    if (lastExitUTC && currentUTC > lastExitUTC) {
      finalStatus = "half_day";
    } else {
      // إذا لم يتجاوز، فيتم التحقق من حالة التأخير
      finalStatus = dmins > 0 ? "late" : "present";
    }
  } else if (
    finalWorkHours + totalRest <
    (daySchedule.official_working_hours || 8)
  ) {
    if (dmins > 0 && emins > 0) finalStatus = "late_and_early_exit";
    else if (dmins > 0) finalStatus = "late";
    else if (emins > 0) finalStatus = "early_exit";
    else finalStatus = "absent";
  } else {
    finalStatus = "present";
  }

  return {
    delayMinutes: dmins,
    earlyExitMinutes: emins,
    overtimeMinutes,
    statusCode: finalStatus,
    workHours: finalWorkHours,
    finalCheckIn: actualCheckIn,
    finalCheckOut: actualCheckOut,
    baseWork,
  };
}

// ==================================================================
//       أكواد "الدوام المتقطع" (في حال works_for_segmented_time=true)
// ==================================================================

/**
 * بناء فترات عمل متعددة من بصمات اليوم (مع طرح الاستراحات لاحقًا)،
 * نستخدم events=3 و 4 للاستراحات، events=1 و 2 لدخول وخروج،
 * وأي حدث خارج 1..5 نعامله بمبدأ الـ toggle (إذا لا يوجد دخول => دخول، وإلا => خروج).
 */
function buildIntervalsForSegmentedMode(dayFingerLogs, dayEndUTC) {
  let intervals = [];
  let restBreaks = [];
  let currentIn = null; // لتتبع بداية فترة العمل
  let currentRestIn = null; // لتتبع بداية الاستراحة

  for (let log of dayFingerLogs) {
    const evt = log.event;
    const t = new Date(log.time);

    switch (evt) {
      case 1:
        // Event 1: دخول فقط، لا يمكن تحويلها إلى خروج
        if (!currentIn) {
          currentIn = t;
        }
        // إذا كانت هناك بصمة دخول مفتوحة، نتجاهل الحدث
        break;

      case 2:
        // Event 2: خروج فقط
        if (currentIn) {
          intervals.push({ inTime: currentIn, outTime: t });
          currentIn = null;
        }
        // إذا لم يكن هناك دخول مفتوح، نتجاهل الحدث
        break;

      case 3:
        // بدء استراحة
        currentRestIn = t;
        break;

      case 4:
        // نهاية استراحة
        if (currentRestIn) {
          restBreaks.push({ rest_in: currentRestIn, rest_out: t });
          currentRestIn = null;
        }
        break;

      case 5:
        // Event 5: لا تفعل شيء
        break;

      default:
        // أي حدث آخر: طبق منطق التبديل
        if (!currentIn) {
          currentIn = t;
        } else {
          intervals.push({ inTime: currentIn, outTime: t });
          currentIn = null;
        }
        break;
    }
  }

  // إذا بقي دخول مفتوح حتى نهاية اليوم، نسجله كخروج في نهاية اليوم
  if (currentIn) {
    intervals.push({ inTime: currentIn, outTime: dayEndUTC });
    currentIn = null;
  }
  return { intervals, restBreaks };
}

/**
 * حساب الـ metrics عند وجود تعدد فترات في نفس اليوم
 * - جمع فترات العمل (intervals)
 * - طرح الاستراحات
 * - حساب التأخير (اعتمادًا على أول دخول)
 * - حساب الخروج المبكر (اعتمادًا على آخر خروج)
 */
function calculateAttendanceMetricsForSegmented({
  intervals,
  restBreaks,
  daySchedule,
  dayStartUTC,
  dayEndUTC,
}) {
  let totalWorkHours = 0;

  // حساب إجمالي ساعات العمل
  for (let iv of intervals) {
    let diffH = (iv.outTime - iv.inTime) / (1000 * 3600);
    if (diffH > 0) totalWorkHours += diffH;
  }

  // حساب مجموع الاستراحة
  let totalRestHours = 0;
  for (let rb of restBreaks) {
    let rdur = (rb.rest_out - rb.rest_in) / (1000 * 3600);
    if (rdur > 0) totalRestHours += rdur;
  }

  // طرح الاستراحات
  let finalWorkHours = totalWorkHours - totalRestHours;
  if (finalWorkHours < 0) finalWorkHours = 0;

  // أول دخول وآخر خروج
  intervals.sort((a, b) => a.inTime - b.inTime);
  let firstInTime = intervals.length ? intervals[0].inTime : null;
  intervals.sort((a, b) => b.outTime - a.outTime);
  let lastOutTime = intervals.length ? intervals[0].outTime : null;

  // التأخير
  let delayMinutes = 0;
  if (firstInTime && firstInTime > dayStartUTC) {
    let dm = (firstInTime - dayStartUTC) / 60000;
    if (
      daySchedule.allowed_delay_minutes &&
      dm <= daySchedule.allowed_delay_minutes
    ) {
      dm = 0;
    }
    delayMinutes = Math.round(dm);
  }

  // الخروج المبكر
  let earlyExitMinutes = 0;
  if (lastOutTime && lastOutTime < dayEndUTC) {
    let em = (dayEndUTC - lastOutTime) / 60000;
    if (
      daySchedule.allowed_exit_minutes &&
      em <= daySchedule.allowed_exit_minutes
    ) {
      em = 0;
    }
    earlyExitMinutes = Math.round(em);
  }

  // الحالة
  let statusCode = "absent";
  if (intervals.length === 0) {
    statusCode = "absent";
  } else {
    // قارن بالساعات الرسمية
    const needed = daySchedule.official_working_hours || 8;
    if (
      finalWorkHours + (daySchedule.allowed_delay_minutes || 0) / 60 >=
      needed - (daySchedule.allowed_exit_minutes || 0) / 60
    ) {
      statusCode = "present";
    } else {
      if (delayMinutes > 0 && earlyExitMinutes > 0)
        statusCode = "late_and_early_exit";
      else if (delayMinutes > 0) statusCode = "late";
      else if (earlyExitMinutes > 0) statusCode = "early_exit";
      else statusCode = "absent";
    }
  }

  // الأوفرتايم
  let overtimeMinutes = 0;
  if (daySchedule.overtime_eligible) {
    let otHours = finalWorkHours - (daySchedule.official_working_hours || 8);
    if (otHours > 0) {
      if (
        daySchedule.minimum_working_hours_overtime &&
        finalWorkHours < daySchedule.minimum_working_hours_overtime
      ) {
        overtimeMinutes = 0;
      } else {
        overtimeMinutes = otHours * 60;
      }
    }
  }

  return {
    delayMinutes,
    earlyExitMinutes,
    overtimeMinutes,
    statusCode,
    workHours: +finalWorkHours.toFixed(2),
    totalRestHours: +totalRestHours.toFixed(2),
    firstInTime,
    lastOutTime,
  };
}

function calculateExpectedWorkingDays(monthDate, employee, officialHolidays) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let expectedDays = 0;
  let current = new Date(firstDay);
  const dayNameMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  while (current <= lastDay) {
    // تجاهل الأيام التي تكون قبل تاريخ المباشرة أو بعد تاريخ ترك العمل إن وجد
    if (employee.joining_date && current < new Date(employee.joining_date)) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    if (employee.leave_date && current > new Date(employee.leave_date)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // التحقق مما إذا كان اليوم عطلة رسمية
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
    if (
      employee.scheduleMode === "shift" &&
      employee.shift_id &&
      employee.shift_id.daysMap
    ) {
      // حساب الفرق بين اليوم الحالي وتاريخ بدء دورة الشفت
      const shiftStart = moment(employee.shift_id.cycleStartDate).startOf(
        "day"
      );
      const diffDays = moment(current).startOf("day").diff(shiftStart, "days");
      const cycleLen = employee.shift_id.cycleLength || 1;
      const cycleDayIndex = ((diffDays % cycleLen) + cycleLen) % cycleLen;
      // البحث في daysMap عن الكائن المطابق
      let dayMapObj = employee.shift_id.daysMap.find(
        (d) => d.dayIndex === cycleDayIndex
      );
      if (dayMapObj && dayMapObj.timeSlot) {
        const ts = dayMapObj.timeSlot;
        // إذا كانت أوقات العمل ليست "00:00:00" فهذا يعتبر يوم عمل
        if (ts.startTime !== "00:00:00" || ts.endTime !== "00:00:00") {
          expectedDays++;
        }
      }
    }
    // إذا كان الموظف يعمل بنظام جدول أسبوعي (weekSchedules)
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

// ==================================================================

/** التقرير */
exports.getFullAttendanceReport = async (req, res) => {
  try {
    // // جلب أول سجل من مجموعة Activition (يُفترض أن يكون دائماً موجودًا)
    // const activitionRecord = await Activition.findOne().sort({ createdAt: 1 });
    // console.log("تم استرجاع سجل التفعيل:", activitionRecord);
    // if (!activitionRecord) {
    //   return res.status(404).json({ error: "لم يتم العثور على بيانات التفعيل في قاعدة البيانات" });
    // }

    // // استخراج الباركود من حقل name
    // const customerBarcode = activitionRecord.name;
    // console.log("الباركود الخاص بالعميل:", customerBarcode);

    // // استدعاء الـ API لجلب التوكن باستخدام الباركود من قاعدة البيانات
    // const tokenUrl = `http://4.2.2.235:3800/api/client/token/${customerBarcode}`;
    // console.log("يتم طلب التوكن من العنوان:", tokenUrl);
    // const tokenResponse = await axios.get(tokenUrl);
    // console.log("استجابة الـ API للتوكن:", tokenResponse.data);

    // // استخراج activationToken من استجابة الـ API
    // const activationToken = tokenResponse.data.activationToken;
    // console.log("التوكن المستخرج:", activationToken);
    // if (!activationToken) {
    //   return res.status(500).json({ error: "فشل في جلب التوكن من الـ API" });
    // }

    // // الحصول على الدومين الحالي من رأس الطلب
    // const currentDomain = req.headers.host;
    // console.log("الدومين الحالي:", currentDomain);

    // // التحقق من الترخيص باستخدام التوكن المستخرج مع فحص الدومين وعدد الأجهزة والموظفين
    // const licenseData = await verifyLicense(activationToken, currentDomain);
    // console.log("بيانات الترخيص المفكوكة:", licenseData);
    let {
      start_date = "2025-02-01",
      end_date = "2025-02-05",
      employee_id = 0,
      department_id = 0,
      show_official_holidays = 1,
      show_weekly_off_days = 1,
      timeZone = req.user?.timeZone ||
        req.employee?.owner?.timeZone ||
        "Asia/Baghdad",
      use_dynamic_hour_price = 0,
      roundvalue = 1,
      status_code,
    } = req.query;

    const useDynamicHourPrice = +use_dynamic_hour_price === 1;
    // إن كان المستخدم الموظف نفسه
    if (req.employee) {
      employee_id = req.employee.enroll_id;
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    const empMatch = {};

    // إذا كانت employee_id موجودة وليست "0"
    if (employee_id && employee_id !== "0") {
      // إذا كانت employee_id تحتوي على فاصلة فهذا يعني أكثر من رقم موظف
      if (employee_id.includes(",")) {
        const employeeIds = employee_id.split(",").map((id) => +id);
        empMatch.enroll_id = { $in: employeeIds };
      } else {
        empMatch.enroll_id = +employee_id;
      }
    }

    if (department_id && department_id !== "0") {
      empMatch.department_id = new ObjectId(department_id);
    }

    // ***** إضافة فلترة حسب tagemployee من الهيدر *****
    const tagemployeeHeader = req.headers.tagemployee; // تأكد أن الهيدر يُرسل بهذا الاسم (الحروف تصبح صغيرة في Node.js)
    if (tagemployeeHeader) {
      // تقسيم القيمة المفصولة بفواصل وتحويل كل عنصر إلى ObjectId
      const tagsArray = tagemployeeHeader
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ""); // إزالة العناصر الفارغة إن وجدت

      if (tagsArray.length > 0) {
        empMatch.tagemployee = {
          $in: tagsArray.map((tag) => new ObjectId(tag)),
        };
      }
    }

    // =============== إضافة populate الشفت + التايم سلات ================
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

    let allDates = generateDateRange(startDate, endDate);

    // بصمات
    let fingerMatch = {
      time: {
        $gte: startDate,
        $lte: new Date(endDate.getTime() + 24 * 3600 * 1000),
      },
    };
    if (employee_id && employee_id !== "0") {
      if (employee_id.includes(",")) {
        const employeeIds = employee_id.split(",").map((id) => +id);
        fingerMatch.enrollid = { $in: employeeIds };
      } else {
        fingerMatch.enrollid = +employee_id;
      }
    }
    const fingerLogs = await FingerPrintLog.find({
      ...fingerMatch,
      owner: req.userId,
    }).lean();

    // العطلات الرسمية
    let officialHolidays = [];
    if (+show_official_holidays === 1) {
      officialHolidays = await OfficialHoliday.find({
        holiday_date: { $gte: startDate, $lte: endDate },
        owner: req.userId,
      }).lean();
    }

    // الاجازات اليومية
    let vacMatch = {
      vacation_end_date: { $gte: startDate },
      vacation_start_date: { $lte: endDate },
    };
    if (+employee_id != 0) vacMatch.enroll_id = +employee_id;
    const vacations = await Vacation.find({
      ...vacMatch,
      owner: req.userId,
    })
      .populate("vacation_type_id")
      .lean();

    // الاجازات الجزئية
    let tblMatch = {
      leave_date: { $gte: startDate, $lte: endDate },
    };
    if (employee_id && employee_id !== "0") {
      if (employee_id.includes(",")) {
        const employeeIds = employee_id.split(",").map((id) => +id);
        tblMatch.enroll_id = { $in: employeeIds };
      } else {
        tblMatch.enroll_id = +employee_id;
      }
    }
    const timeBasedLeaves = await TimeBasedLeave.find({
      ...tblMatch,
      owner: req.userId,
    }).lean();

    // مكافآت وجزاءات
    let rpMatch = {
      date: { $gte: startDate, $lte: endDate },
    };
    if (+employee_id !== 0) rpMatch.enroll_id = +employee_id;
    const rpData = await RewardsAndPenalties.find({
      ...rpMatch,
      owner: req.userId,
    }).lean();

    // =============== جلب الدقائق الإضافية للفترة ===============
    const extraMinutesData = await ExtraMinutes.find({
      owner: req.userId,
      bonus_date: { $gte: startDate, $lte: endDate },
    }).lean();

    // تكوين خريطة لسهولة الوصول لمجموع الدقائق لكل موظف في كل يوم
    let extraMinutesMap = {};
    for (let em of extraMinutesData) {
      let eId = em.enroll_id;
      let dateStr = new Date(em.bonus_date).toISOString().split("T")[0];
      if (!extraMinutesMap[eId]) extraMinutesMap[eId] = {};
      if (!extraMinutesMap[eId][dateStr]) extraMinutesMap[eId][dateStr] = 0;
      extraMinutesMap[eId][dateStr] += em.minutes;
    }
    // ===========================================================

    const dayNameMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let finalResults = [];
    let sumRequiredWorkHours = 0;

    // 1) الحساب الأساسي لكل يوم لكل موظف
    for (const emp of employees) {
      // حساب عدد أيام العمل الرسمية للموظف خلال الفترة
      let empWorkingDays = 0;
      allDates.forEach((dateObj) => {
        const dateStr = dateObj.toISOString().split("T")[0];
        if (emp.joining_date && dateObj < new Date(emp.joining_date)) return;
        if (emp.leave_date && dateObj > new Date(emp.leave_date)) return;

        let dayIndex = dateObj.getDay();
        let dayName = dayNameMap[dayIndex];
        let tempSchedule = null;

        // ======== نظام الشفت =========
        if (
          emp.scheduleMode === "shift" &&
          emp.shift_id &&
          emp.shift_id.daysMap
        ) {
          const shiftStart = moment(emp.shift_id.cycleStartDate).startOf("day");
          const diffDays = moment(dateObj)
            .startOf("day")
            .diff(shiftStart, "days");
          const cycleLen = emp.shift_id.cycleLength || 1;
          const cycleDayIndex = ((diffDays % cycleLen) + cycleLen) % cycleLen;
          let dayMapObj = emp.shift_id.daysMap.find(
            (d) => d.dayIndex === cycleDayIndex
          );
          if (dayMapObj && dayMapObj.timeSlot) {
            let ts = dayMapObj.timeSlot;
            tempSchedule = {
              startTime: ts.startTime || "00:00:00",
              endTime: ts.endTime || "00:00:00",
              official_working_hours: ts.officialWorkingHours || 8,
              startTime_Offset: ts.startTime_Offset || 0,
              endTime_Offset: ts.endTime_Offset || 0,
              work_registration_start_time_Offset:
                ts.work_registration_start_time_Offset || 0,
              last_entry_prevention_time_Offset:
                ts.last_entry_prevention_time_Offset || 0,
              overtimeStart_Offset: ts.overtimeStart_Offset || 0,
              first_exit_allowed_time_Offset:
                ts.first_exit_allowed_time_Offset || 0,
              last_exit_allowed_time_Offset:
                ts.last_exit_allowed_time_Offset || 0,
              work_registration_start_time: ts.workRegistrationStartTime,
              last_entry_prevention_time: ts.lastEntryPreventionTime,
              overtimeStart: ts.overtimeStartTime,
              minimum_working_hours_overtime:
                ts.minimumWorkingHoursOvertime || 10,
              allowed_delay_minutes: ts.allowedDelayMinutes || 0,
              allowed_exit_minutes: ts.allowedExitMinutes || 0,
              works_for_daily_wage: ts.worksForDailyWage || false,
              overtime_eligible: ts.overtimeEligible || false,
              hourPrice: ts.hourPrice || 0,
              overtimePrice: ts.overtimePrice || 0,
              daily_salary: ts.dailySalary || 0,
              allowed_min_rest: ts.allowed_min_rest || 0,
              rest_min_prices: ts.rest_min_prices || 0,
              absent_cutting: ts.absent_cutting || 0,
              late_min_prices: ts.late_min_prices || 0,
              early_min_prices: ts.early_min_prices || 0,
              late_cutting_by_count: ts.late_cutting_by_count || 0,
              early_cutting_by_count: ts.early_cutting_by_count || 0,
              first_exit_allowed_time: ts.first_exit_allowed_time,
              last_exit_allowed_time: ts.last_exit_allowed_time,
              works_for_segmented_time: ts.worksForSegmentedTime || false,
            };
          }
        }

        // إذا لم يكن هناك جدول شفت، نأخذ weekSchedules
        if (!tempSchedule) {
          tempSchedule = emp.weekSchedules?.find((ws) => ws.day === dayName);
        }
        if (
          tempSchedule &&
          !(
            tempSchedule.startTime === "00:00:00" &&
            tempSchedule.endTime === "00:00:00"
          )
        ) {
          empWorkingDays++;
        }
      });

      // بدء معالجة كل يوم للموظف
      for (const dateObj of allDates) {
        const dateStr = dateObj.toISOString().split("T")[0];
        // إن كان قبل تاريخ المباشرة
        if (emp.joining_date && dateObj < new Date(emp.joining_date)) continue;
        // أو بعد تاريخ ترك العمل
        if (emp.leave_date && dateObj > new Date(emp.leave_date)) continue;

        let dayIndex = dateObj.getDay();
        let dayName = dayNameMap[dayIndex];
        let daySchedule = null;

        // ======== نظام الشفت =========
        if (
          emp.scheduleMode === "shift" &&
          emp.shift_id &&
          emp.shift_id.daysMap
        ) {
          const shiftStart = moment(emp.shift_id.cycleStartDate).startOf("day");
          const diffDays = moment(dateObj)
            .startOf("day")
            .diff(shiftStart, "days");
          const cycleLen = emp.shift_id.cycleLength || 1;
          const cycleDayIndex = ((diffDays % cycleLen) + cycleLen) % cycleLen;

          console.log(
            "[DEBUG SHIFT] الموظف:",
            emp.enroll_id,
            ", تاريخ اليوم:",
            dateStr,
            ", diffDays=",
            diffDays,
            ", cycleLen=",
            cycleLen,
            "=> cycleDayIndex=",
            cycleDayIndex
          );

          let dayMapObj = emp.shift_id.daysMap.find(
            (d) => d.dayIndex === cycleDayIndex
          );

          if (dayMapObj) {
            console.log(
              "[DEBUG SHIFT] تم العثور على dayMapObj لـ cycleDayIndex=",
              cycleDayIndex,
              ", timeSlot=",
              dayMapObj.timeSlot
            );
          } else {
            console.log(
              "[DEBUG SHIFT] لم يتم العثور على dayMapObj لـ cycleDayIndex=",
              cycleDayIndex
            );
          }

          let ts = dayMapObj?.timeSlot;
          if (ts) {
            daySchedule = {
              startTime: ts.startTime || "00:00:00",
              endTime: ts.endTime || "00:00:00",
              official_working_hours: ts.officialWorkingHours || 8,
              minimum_working_hours_overtime:
                ts.minimumWorkingHoursOvertime || 10,
              allowed_delay_minutes: ts.allowedDelayMinutes || 0,
              allowed_exit_minutes: ts.allowedExitMinutes || 0,
              works_for_daily_wage: ts.worksForDailyWage || false,
              overtime_eligible: ts.overtimeEligible || false,
              hour_price: ts.hourPrice || 0,
              hourPrice: ts.hourPrice || 0, // لضمان التوافق
              overtime_price: ts.overtimePrice || 0,
              overtimePrice: ts.overtimePrice || 0, // لضمان التوافق
              daily_salary: ts.dailySalary || 0,
              allowed_min_rest: ts.allowed_min_rest || 0,
              rest_min_prices: ts.rest_min_prices || 0,
              absent_cutting: ts.absent_cutting || 0,
              late_min_prices: ts.late_min_prices || 0,
              early_min_prices: ts.early_min_prices || 0,
              late_cutting_by_count: ts.late_cutting_by_count || 0,
              early_cutting_by_count: ts.early_cutting_by_count || 0,
              first_exit_allowed_time: ts.first_exit_allowed_time,
              last_exit_allowed_time: ts.last_exit_allowed_time,
              works_for_segmented_time: ts.worksForSegmentedTime || false,

              // الحقول الجديدة للأوفست
              startTime_Offset: ts.startTime_Offset || 0,
              endTime_Offset: ts.endTime_Offset || 0,
              work_registration_start_time_Offset:
                ts.work_registration_start_time_Offset || 0,
              last_entry_prevention_time_Offset:
                ts.lastEntryPreventionTime_Offset || 0, // تأكد من الاسم الصحيح
              overtimeStart_Offset: ts.overtimeStart_Offset || 0,
              first_exit_allowed_time_Offset:
                ts.first_exit_allowed_time_Offset || 0,
              last_exit_allowed_time_Offset:
                ts.last_exit_allowed_time_Offset || 0,

              // الأوقات الأخرى
              work_registration_start_time: ts.workRegistrationStartTime,
              last_entry_prevention_time: ts.lastEntryPreventionTime,
              overtimeStart: ts.overtimeStartTime,
            };
          }
        }
        // =========================
        // إذا لم يكن هناك شفت، استخدم weekSchedules
        if (!daySchedule) {
          daySchedule = emp.weekSchedules?.find((ws) => ws.day === dayName);
        }

        const reportMonthDate = new Date(start_date);
        const expectedWorkDays = calculateExpectedWorkingDays(
          reportMonthDate,
          emp,
          officialHolidays
        );
        const holidayDays = officialHolidays.length;
        let record = {
          enroll_id: emp.enroll_id,
          employee_name: emp.name,
          department_id: emp.department_id ? emp.department_id._id : null,
          department_name: emp.department,
          attendance_date: dateStr,

          day: dayName,
          dynamic_hour_price:
            emp.main_salary &&
            expectedWorkDays &&
            daySchedule &&
            daySchedule.official_working_hours
              ? emp.main_salary /
                ((expectedWorkDays + holidayDays) *
                  daySchedule.official_working_hours)
              : 0,

          check_in: null,
          check_out: null,
          rest_breaks: [],
          total_rest_duration: 0,

          delay_minutes: 0,
          early_exit_minutes: 0,
          overtime_minutes: 0,
          status_code: "absent",
          work_hours: 0,

          daily_salary: daySchedule?.daily_salary || 0,
          hour_price: daySchedule?.hour_price || 0,
          overtime_price: daySchedule?.overtime_price || 0,
          works_for_daily_wage: daySchedule?.works_for_daily_wage || false,
          official_working_hours: daySchedule?.official_working_hours || 8,

          minimum_working_hours_overtime:
            daySchedule?.minimum_working_hours_overtime || 10,

          salary_earned_for_work: 0,
          overtime_entitlement: 0,
          late_cutting_by_count: 0,
          early_cutting_by_count: 0,
          absent_cutting: 0,
          late_arrival_deduction: 0,
          early_exit_deduction: 0,

          rewards_penalties_amount: 0,
          net_salary_before_rounding: 0,
          net_salary: 0,
        };

        // لو لا يوجد جدول لهذا اليوم => عطلة أسبوعية
        if (!daySchedule) {
          if (+show_weekly_off_days === 1) {
            record.status_code = "week_work_off";
            console.log(
              "[DEBUG RESULT - لا يوجد daySchedule => عطلة أسبوعية]",
              record
            );
            finalResults.push(record);
          }
          continue;
        }

        // لو يوم راحة كامل
        if (
          daySchedule.startTime === "00:00:00" &&
          daySchedule.endTime === "00:00:00"
        ) {
          record.status_code = "أستراحة";
          if (daySchedule.daily_salary > 0) {
            record.salary_earned_for_work = daySchedule.daily_salary;
          }
          console.log("[DEBUG RESULT - يوم راحة كامل]", record);
          finalResults.push(record);
          continue;
        }

        // حساب الـ UTC من الحقول العادية
        let dayStartUTC = localTimeToUTC(
          dateObj,
          daySchedule.startTime,
          timeZone
        );
        let dayEndUTC = localTimeToUTC(dateObj, daySchedule.endTime, timeZone);

        // ثم تطبيق الأوفست المخصص لكل وقت:
        if (daySchedule.startTime_Offset) {
          dayStartUTC = new Date(
            dayStartUTC.getTime() +
              daySchedule.startTime_Offset * 24 * 3600 * 1000
          );
        }
        if (daySchedule.endTime_Offset) {
          dayEndUTC = new Date(
            dayEndUTC.getTime() + daySchedule.endTime_Offset * 24 * 3600 * 1000
          );
        }
        record.scheduled_start_time = utcToLocalString(dayStartUTC, timeZone);
        record.scheduled_end_time = utcToLocalString(dayEndUTC, timeZone);

        let wrStartUTC = null;
        if (daySchedule.work_registration_start_time) {
          wrStartUTC = localTimeToUTC(
            dateObj,
            daySchedule.work_registration_start_time,
            timeZone
          );
          if (daySchedule.work_registration_start_time_Offset) {
            wrStartUTC = new Date(
              wrStartUTC.getTime() +
                daySchedule.work_registration_start_time_Offset *
                  24 *
                  3600 *
                  1000
            );
          }
        }

        let overtimeStartUTC = null;
        if (daySchedule.overtimeStart) {
          overtimeStartUTC = localTimeToUTC(
            dateObj,
            daySchedule.overtimeStart,
            timeZone
          );
          if (daySchedule.overtimeStart_Offset) {
            overtimeStartUTC = new Date(
              overtimeStartUTC.getTime() +
                daySchedule.overtimeStart_Offset * 24 * 3600 * 1000
            );
          }
          daySchedule.overtimeStartUTC = overtimeStartUTC;
        }

        let lastEntryPreventionUTC = null;
        if (daySchedule.last_entry_prevention_time) {
          lastEntryPreventionUTC = localTimeToUTC(
            dateObj,
            daySchedule.last_entry_prevention_time,
            timeZone
          );
          if (daySchedule.last_entry_prevention_time_Offset) {
            lastEntryPreventionUTC = new Date(
              lastEntryPreventionUTC.getTime() +
                daySchedule.last_entry_prevention_time_Offset * 24 * 3600 * 1000
            );
          }
          daySchedule.lastEntryPreventionUTC = lastEntryPreventionUTC;
        }

        let firstExitUTC = null,
          lastExitUTC = null;
        if (daySchedule.first_exit_allowed_time) {
          firstExitUTC = localTimeToUTC(
            dateObj,
            daySchedule.first_exit_allowed_time,
            timeZone
          );
          if (daySchedule.first_exit_allowed_time_Offset) {
            firstExitUTC = new Date(
              firstExitUTC.getTime() +
                daySchedule.first_exit_allowed_time_Offset * 24 * 3600 * 1000
            );
          }
        }
        if (daySchedule.last_exit_allowed_time) {
          lastExitUTC = localTimeToUTC(
            dateObj,
            daySchedule.last_exit_allowed_time,
            timeZone
          );
          if (daySchedule.last_exit_allowed_time_Offset) {
            lastExitUTC = new Date(
              lastExitUTC.getTime() +
                daySchedule.last_exit_allowed_time_Offset * 24 * 3600 * 1000
            );
          }
        }

        // فلترة البصمات
        let dayFingerLogs = fingerLogs
          .filter((f) => {
            if (String(f.enrollid) !== String(emp.enroll_id)) return false;
            let fTime = new Date(f.time);
            return (
              fTime <= Math.max(dayEndUTC, lastExitUTC || dayEndUTC) &&
              fTime >= (wrStartUTC || dayStartUTC)
            );
          })
          .sort((a, b) => new Date(a.time) - new Date(b.time));

        // --------------------------------------------
        // إضافة هذا المقطع قبل if (partial) مباشرة
        // --------------------------------------------
        let segmentedIntervals = [];
        let segmentedRestBreaks = [];

        // إذا كان الموظف أو الجدول يعمل بنظام الدوام المتعدّد
        if (
          emp.works_for_segmented_time ||
          daySchedule.works_for_segmented_time
        ) {
          const { intervals, restBreaks: multiBreaks } =
            buildIntervalsForSegmentedMode(dayFingerLogs, dayEndUTC);
          segmentedIntervals = intervals;
          segmentedRestBreaks = multiBreaks;
        }
        // --------------------------------------------

        // الاستراحات
        let logsEvent3 = dayFingerLogs.filter((x) => x.event === 3);
        let logsEvent4 = dayFingerLogs.filter((x) => x.event === 4);
        let restBreaks = matchMultipleBreaks(logsEvent3, logsEvent4);

        // تعديل الإجازات الجزئية
        let partial = timeBasedLeaves.find((tb) => {
          let tbDate = new Date(tb.leave_date).toISOString().split("T")[0];
          return (
            String(tb.enroll_id) === String(emp.enroll_id) && tbDate === dateStr
          );
        });

        // النظام القديم: استخدام فقط event 1 لتعيين check-in واستخدام event 2 لتعيين check-out
        let checkInUTC = null;
        let checkOutUTC = null;

        let validEvents = [0, 1, 2, 3, 4, 5];
        let primaryLogs = dayFingerLogs.filter((x) =>
          validEvents.includes(x.event)
        );

        if (primaryLogs.length > 0) {
          // تحديد بصمة الدخول (event === 1)
          let login = primaryLogs.find((x) => x.event === 1);
          if (!login) {
            login = primaryLogs[0];
          }
          checkInUTC = login.time;

          // محاولة استخراج بصمة الخروج من أحداث event === 2
          let logoutLogs = primaryLogs.filter((x) => x.event === 2);
          logoutLogs = logoutLogs.filter((x) => {
            const logTime = new Date(x.time);
            return (
              (!firstExitUTC || logTime >= firstExitUTC) &&
              (!lastExitUTC || logTime <= lastExitUTC)
            );
          });
          logoutLogs.sort((a, b) => new Date(a.time) - new Date(b.time));

          if (logoutLogs.length > 0) {
            checkOutUTC = logoutLogs[logoutLogs.length - 1].time;
          } else {
            // إذا لم يوجد event === 2، نبحث عن event === 0 بشرط أن لا يكون نفس بصمة الدخول
            // وأن يكون ضمن الفترة المسموحة للخروج
            let fallbackLogs = dayFingerLogs.filter((x) => {
              if (x.event !== 0) return false;
              if (x.time === checkInUTC) return false;
              const logTime = new Date(x.time);
              return (
                (!firstExitUTC || logTime >= firstExitUTC) &&
                (!lastExitUTC || logTime <= lastExitUTC)
              );
            });
            fallbackLogs.sort((a, b) => new Date(a.time) - new Date(b.time));
            if (fallbackLogs.length > 0) {
              checkOutUTC = fallbackLogs[fallbackLogs.length - 1].time;
            }
          }
        }
        // ملاحظة: إذا لم توجد بصمة دخول من event 1، فإن checkInUTC ستبقى null مما يعني أن الدخول غير مسجل (ويمكن اعتبار اليوم غياباً)

        // تطبيق الإجازة الجزئية
        if (partial) {
          // النظام القديم
          if (
            !emp.works_for_segmented_time &&
            !daySchedule.works_for_segmented_time
          ) {
            if (checkInUTC && partial.leave_duration_for_entry) {
              let cIn = new Date(checkInUTC);
              cIn.setMinutes(
                cIn.getMinutes() - partial.leave_duration_for_entry
              );
              checkInUTC = cIn;
            }
            if (checkOutUTC && partial.leave_duration_for_exit) {
              let cOut = new Date(checkOutUTC);
              cOut.setMinutes(
                cOut.getMinutes() + partial.leave_duration_for_exit
              );
              checkOutUTC = cOut;
            }
          } else {
            // الدوام المتعدد
            if (segmentedIntervals.length > 0) {
              if (partial.leave_duration_for_entry) {
                segmentedIntervals[0].inTime = new Date(
                  segmentedIntervals[0].inTime.getTime() -
                    partial.leave_duration_for_entry * 60000
                );
              }
              if (partial.leave_duration_for_exit) {
                let lastIdx = segmentedIntervals.length - 1;
                segmentedIntervals[lastIdx].outTime = new Date(
                  segmentedIntervals[lastIdx].outTime.getTime() +
                    partial.leave_duration_for_exit * 60000
                );
              }
            }
          }
          // **إضافة القيم إلى سجل التقرير**
          record.leave_duration_for_entry =
            partial.leave_duration_for_entry || 0;
          record.leave_duration_for_exit = partial.leave_duration_for_exit || 0;
        }

        // مكافآت / جزاءات
        let rpItems = rpData.filter((r) => {
          let rDate = new Date(r.date).toISOString().split("T")[0];
          return (
            String(r.enroll_id) === String(emp.enroll_id) && rDate === dateStr
          );
        });
        let rpAmount = rpItems.reduce((sum, r) => sum + (r.amount || 0), 0);
        record.rewards_penalties_amount = rpAmount;

        // عطلة رسمية؟
        let holidayDoc = officialHolidays.find((h) => {
          let hDate = new Date(h.holiday_date).toISOString().split("T")[0];
          return hDate === dateStr;
        });
        // إجازة يومية؟
        let foundVacation = vacations.find(
          (v) =>
            String(v.enroll_id) === String(emp.enroll_id) &&
            new Date(v.vacation_start_date) <= dateObj &&
            new Date(v.vacation_end_date) >= dateObj
        );

        if (holidayDoc) {
          record.status_code = "holiday";
        } else if (
          foundVacation &&
          foundVacation.status === "Approved" &&
          foundVacation.is_paid
        ) {
          // إجازة مدفوعة
          let vacName =
            foundVacation.vacation_type_id?.vacation_name || "إجازة مدفوعة";
          record.status_code = vacName;
          record.is_vacation_day = true;
          record.is_paid_vacation = true;
          record.vacation_status = foundVacation.status;
          // نحسب الراتب: (ساعات العمل الرسمية × سعر الساعة)
          const offHours = daySchedule.official_working_hours || 8;
          const hrPrice = daySchedule.hour_price || daySchedule.hourPrice || 0;
          record.salary_earned_for_work = offHours * hrPrice;

          finalResults.push(record);
          continue;
        } else if (foundVacation && foundVacation.status === "Pending") {
          // إجازة قيد الانتظار
          record.status_code = "أجازة انتظار";
          record.is_vacation_day = true;
          record.is_paid_vacation = !!foundVacation.is_paid;
          record.vacation_status = foundVacation.status;
        } else if (foundVacation && foundVacation.status === "Rejected") {
          // إذا كانت حالة الإجازة "Rejected" نُسجل الحالة فقط دون تغيير status_code
          record.is_vacation_day = false;
          record.vacation_status = foundVacation.status;
          // لا نقوم بتعيين حالة اليوم كـ "absent" أو أي تغيير آخر
        } else if (foundVacation) {
          // إجازة غير مدفوعة أو حالة أخرى
          let vacName =
            foundVacation.vacation_type_id?.vacation_name || "إجازة غير مدفوعة";
          record.status_code = vacName;
          record.is_vacation_day = true;
          record.is_paid_vacation = !!foundVacation.is_paid;
          record.vacation_status = foundVacation.status;
        } else {
          record.is_vacation_day = false;
          record.is_paid_vacation = false;
          record.vacation_status = null;
        }
        // الآن نحدد نداء الدالة الحسابية
        if (
          !daySchedule.works_for_segmented_time &&
          !emp.works_for_segmented_time
        ) {
          let metrics = calculateAttendanceMetrics({
            checkInUTC,
            checkOutUTC,
            restBreaks,
            daySchedule,
            dayStartUTC,
            dayEndUTC,
            workRegStartUTC: wrStartUTC,
            firstExitUTC,
            lastExitUTC,
            lastEntryPreventionUTC,
            overtimeStartUTC,
          });
          record.delay_minutes = metrics.delayMinutes;
          record.early_exit_minutes = metrics.earlyExitMinutes;
          record.overtime_minutes = metrics.overtimeMinutes;
          if (
            record.status_code === "holiday" ||
            record.status_code === "أجازة انتظار"
          ) {
            // لا نغيّر status_code
          } else if (record.is_vacation_day) {
            // تم تعيينها أعلاه بنوع الإجازة
          } else {
            record.status_code = metrics.statusCode;
          }
          record.work_hours = +metrics.workHours.toFixed(2);
          record.check_in = metrics.finalCheckIn
            ? utcToLocalString(metrics.finalCheckIn, timeZone)
            : null;
          record.check_out = metrics.finalCheckOut
            ? utcToLocalString(metrics.finalCheckOut, timeZone)
            : null;
          record.base_work_hours = +metrics.baseWork.toFixed(2);

          // دقائق الاستراحة
          let totalR = 0;
          let displayedBreaks = [];
          for (let b of restBreaks) {
            let rInLocal = utcToLocalString(b.rest_in, timeZone);
            let rOutLocal = utcToLocalString(b.rest_out, timeZone);
            totalR += b.duration;
            displayedBreaks.push({
              rest_in: rInLocal,
              rest_out: rOutLocal,
              duration: +b.duration.toFixed(2),
            });
          }
          record.rest_breaks = displayedBreaks;
          record.total_rest_duration = +totalR.toFixed(2);
        } else {
          let metrics2 = calculateAttendanceMetricsForSegmented({
            intervals: segmentedIntervals,
            restBreaks,
            daySchedule,
            dayStartUTC,
            dayEndUTC,
          });

          record.delay_minutes = metrics2.delayMinutes;
          record.early_exit_minutes = metrics2.earlyExitMinutes;
          record.overtime_minutes = metrics2.overtimeMinutes;
          if (
            record.status_code === "holiday" ||
            record.status_code === "أجازة انتظار"
          ) {
            // لا نغيّر status_code
          } else if (record.is_vacation_day) {
            // تم تعيينها أعلاه بنوع الإجازة
          } else {
            record.status_code = metrics2.statusCode;
          }
          record.work_hours = metrics2.workHours;

          record.total_rest_duration = metrics2.totalRestHours;

          if (metrics2.firstInTime) {
            record.check_in = utcToLocalString(metrics2.firstInTime, timeZone);
          }
          if (metrics2.lastOutTime) {
            record.check_out = utcToLocalString(metrics2.lastOutTime, timeZone);
          }

          let displayedBreaks = [];
          for (let b of restBreaks) {
            displayedBreaks.push({
              rest_in: utcToLocalString(b.rest_in, timeZone),
              rest_out: utcToLocalString(b.rest_out, timeZone),
              duration: +((b.rest_out - b.rest_in) / 3600000).toFixed(2),
            });
          }
          record.rest_breaks = displayedBreaks;

          let intervalsForReport = [];
          for (let iv of segmentedIntervals) {
            intervalsForReport.push({
              inTime: utcToLocalString(iv.inTime, timeZone),
              outTime: utcToLocalString(iv.outTime, timeZone),
              duration: +((iv.outTime - iv.inTime) / 3600000).toFixed(2),
            });
          }
          record.work_intervals = intervalsForReport;

          record.base_work_hours = record.work_hours;
        }

        // ========== إضافة الدقائق الإضافية =============
        let extraMins = 0;
        if (
          extraMinutesMap[emp.enroll_id] &&
          extraMinutesMap[emp.enroll_id][dateStr]
        ) {
          extraMins = extraMinutesMap[emp.enroll_id][dateStr];
        }
        record.extra_minutes = extraMins;
        // نضيفها إلى ساعات العمل
        record.work_hours += extraMins / 60;
        if (
          !record.check_in && // إذا لم توجد بصمة دخول
          record.work_hours <= 0 &&
          !record.is_vacation_day &&
          record.status_code !== "holiday" &&
          record.status_code !== "week_work_off" &&
          record.status_code !== "rest_day"
        ) {
          record.status_code = "absent";
        }
        // ================================================

        // أوفر تايم
        let otRate =
          daySchedule.overtime_price || daySchedule.overtimePrice || 0;
        let overtimeHours = record.overtime_minutes / 60;
        let overtimeValue = overtimeHours * otRate;
        record.overtime_entitlement = +overtimeValue.toFixed(2);

        // الآن بقية الحسابات المالية
        if (record.status_code === "absent") {
          record.absent_cutting = daySchedule.absent_cutting || 0;
        }

        // العامل باليومية
        if (
          daySchedule.works_for_daily_wage &&
          ![
            "holiday",
            "rest_day",
            "absent",
            "week_work_off",
            "أستراحة",
            "أجازة انتظار",
          ].includes(record.status_code)
        ) {
          record.salary_earned_for_work = daySchedule.daily_salary || 0;
        }
        // العامل بالساعة
        else if (
          !daySchedule.works_for_daily_wage &&
          ![
            "holiday",
            "rest_day",
            "absent",
            "week_work_off",
            "أستراحة",
            "أجازة انتظار",
          ].includes(record.status_code)
        ) {
          const hourPrice = useDynamicHourPrice
            ? record.dynamic_hour_price
            : daySchedule.hour_price || daySchedule.hourPrice || 0;

          const salary = record.work_hours * hourPrice;
          const roundedSalary = Math.round(salary / roundvalue) * roundvalue;
          record.salary_earned_for_work = roundedSalary;
        }

        // خصومات التأخير والخروج المبكر
        const delayMinPrice = daySchedule.late_min_prices || 0;
        const earlyExitMinPrice = daySchedule.early_min_prices || 0;
        const lateCountCut = daySchedule.late_cutting_by_count || 0;
        const earlyCountCut = daySchedule.early_cutting_by_count || 0;

        if (record.delay_minutes > 0) {
          record.late_arrival_deduction = record.delay_minutes * delayMinPrice;
          record.late_cutting_by_count = lateCountCut;
        }
        if (record.early_exit_minutes > 0) {
          record.early_exit_deduction =
            record.early_exit_minutes * earlyExitMinPrice;
          record.early_cutting_by_count = earlyCountCut;
        }

        // دقائق الاستراحة الزائدة
        const allowedMinRest = daySchedule.allowed_min_rest || 0;
        const restMinPrices = daySchedule.rest_min_prices || 0;
        const totalRestMinutes = record.total_rest_duration * 60;
        record.rest_cutting = 0;
        if (totalRestMinutes > allowedMinRest) {
          const diff = totalRestMinutes - allowedMinRest;
          record.rest_cutting = diff * restMinPrices;
        }

        // حساب أولي للراتب الصافي
        let netVal =
          record.salary_earned_for_work +
          record.overtime_entitlement -
          record.rest_cutting -
          record.late_arrival_deduction -
          record.early_exit_deduction -
          (record.absent_cutting || 0) -
          record.late_cutting_by_count -
          record.early_cutting_by_count +
          record.rewards_penalties_amount;

        record.net_salary_before_rounding = netVal;
        record.net_salary = netVal;

        if (
          !holidayDoc &&
          daySchedule.startTime !== "00:00:00" &&
          daySchedule.endTime !== "00:00:00"
        ) {
          sumRequiredWorkHours += daySchedule.official_working_hours || 8;
        }

        console.log("[DEBUG RESULT - قبل الدفع في finalResults]", record);

        finalResults.push(record);
      }
    }

    // 2) ترتيب النتائج
    finalResults.sort((a, b) => {
      let d1 = (a.attendance_date || "").localeCompare(b.attendance_date || "");
      if (d1 !== 0) return d1;
      return (a.employee_name || "").localeCompare(b.employee_name || "");
    });

    // 3) تحويل status_code إلى اسم للعرض (إن وجد في StatusName)
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

    // 4) جلب قواعد المستخدم وتطبيقها
    const userRules = await Rule.find({ owner: req.userId }).lean();
    for (let i = 0; i < finalResults.length; i++) {
      finalResults[i] = applyRulesToRecord(finalResults[i], userRules);

      // بعد التعديل، نعيد حساب net_salary استنادًا إلى القيم النهائية
      let rec = finalResults[i];
      let netVal =
        (rec.salary_earned_for_work || 0) +
        (rec.overtime_entitlement || 0) -
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

    // 5) فلتر الحالة (status_code) إن وُجد
    if (status_code) {
      finalResults = finalResults.filter((r) => r.status_code === status_code);
    }

    // 6) حساب الملخص بعد تطبيق القواعد والفلتر
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
      if (r.status_code === "holiday") {
        officialHolidayCount++;
      } else if (r.status_code === "week_work_off") {
        week_work_offcount++;
      } else if (
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
    const reportMonthDate = new Date(start_date);
    const expectedWorkDays = calculateExpectedWorkingDays(
      reportMonthDate,
      employees[0],
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
        ` | المجموع الصافي للمكافآت والعقوبات=${sumRP}` +
        ` | صافي=${Number(sumNet).toFixed(2)}` +
        ` | مجموع الاستراحة(ساعة)=${sumTotalRestDuration.toFixed(2)}` +
        ` | ساعات العمل الأساسية=${sumBaseWork.toFixed(2)}` +
        ` | إجازات مدفوعة=${countPaidLeaves}` +
        ` | إجازات غير مدفوعة=${countUnpaidLeaves}` +
        ` | إجازات انتظار=${countPendingLeaves}` +
        ` | إجازات زمنية=${countTimeBasedLeaves}` +
        ` | دقائق اجازات زمنية للدخول=${sumEntryLeaveMins}` +
        ` | دقائق اجازات زمنية للخروج=${sumExitLeaveMins}` +
        ` | اجمالي عطل رسمية=${officialHolidayCount}` +
        ` | ايام الاستراحة=${restDayCount}` +
        ` | ايام العمل الرسمية=${workingDayCount}` +
        ` | ايام عطل اسبوعية=${week_work_offcount}` +
        ` | ساعات العمل المطلوبة=${sumRequiredWorkHours}` +
        ` | أيام الدوام المتوقعة لهذا الشهر=${expectedWorkDays}`,
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

    // بعد بناء finalResults بالكامل
    finalResults = await applyFlexibleAggregateRules(finalResults, {
      ownerId: req.userId,
      reportStartDate: startDate,
      reportEndDate: endDate,
      timeZone,
    });

    return res.json(finalResults);
  } catch (err) {
    console.error("License verification failed:", err.message);
    return res.status(403).json({ error: "نسخة غير مرخصة: " + err.message });
  }
};

/**
 * API endpoint للتحقق من حالة بصمة الموظف في وقت محدد (UTC)
 * المدخلات:
 *   - employee_id: رقم الموظف
 *   - timestamp: التاريخ والوقت بصيغة ISO (UTC)
 *
 * المخرجات:
 *   - في حال تحقق شروط الدخول: { success: true, message: "Fingerprint accepted successfully" }
 *   - وإلا: { success: false, message: <سبب الرفض باللغة الإنجليزية> }
 */
exports.checkEmployeeStatus = async (req, res) => {
  try {
    const { employee_id, timestamp } = req.body;
    if (!employee_id || !timestamp) {
      return res
        .status(400)
        .json({ success: false, message: "Missing employee_id or timestamp" });
    }

    // تحويل الـ timestamp إلى كائن Date (نفترض أنه بصيغة UTC)
    const checkTimeUTC = new Date(timestamp);
    if (isNaN(checkTimeUTC.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid timestamp" });
    }

    // الحصول على المنطقة الزمنية (يمكن استخدام الإعدادات للمستخدم أو القيمة الافتراضية)
    const timeZone = req.user?.timeZone || "Asia/Baghdad";

    // جلب بيانات الموظف (مع بعض الحقول الضرورية مثل shift أو weekSchedules)
    const employee = await require("../models/Employee")
      .findOne({
        enroll_id: employee_id,
        owner: req.userId,
      })
      .populate("shift_id")
      .lean();
    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    // تحديد بداية اليوم بحسب المنطقة الزمنية
    const localDate = require("moment")(checkTimeUTC)
      .tz(timeZone)
      .startOf("day")
      .toDate();
    const dateStr = localDate.toISOString().split("T")[0];

    // تحديد جدول العمل لليوم (Shift mode أو weekSchedules)
    let daySchedule = null;
    const dayName = require("moment")(checkTimeUTC).tz(timeZone).format("ddd"); // مثل "Mon", "Tue", ...
    if (
      employee.scheduleMode === "shift" &&
      employee.shift_id &&
      employee.shift_id.daysMap
    ) {
      const shiftStart = require("moment")(
        employee.shift_id.cycleStartDate
      ).startOf("day");
      const diffDays = require("moment")(localDate).diff(shiftStart, "days");
      const cycleLen = employee.shift_id.cycleLength || 1;
      const cycleDayIndex = ((diffDays % cycleLen) + cycleLen) % cycleLen;
      const dayMapObj = employee.shift_id.daysMap.find(
        (d) => d.dayIndex === cycleDayIndex
      );
      if (dayMapObj && dayMapObj.timeSlot) {
        const ts = dayMapObj.timeSlot;
        daySchedule = {
          startTime: ts.startTime || "00:00:00",
          endTime: ts.endTime || "00:00:00",
          work_registration_start_time: ts.workRegistrationStartTime, // بداية تسجيل الحضور
          last_entry_prevention_time: ts.lastEntryPreventionTime, // حد منع الدخول
        };
      }
    } else if (employee.weekSchedules && employee.weekSchedules.length > 0) {
      daySchedule = employee.weekSchedules.find((ws) => ws.day === dayName);
    }

    // إذا لم يتوفر جدول للعمل، فهذا يعني أن اليوم عطلة أسبوعية
    if (!daySchedule) {
      return res.json({ success: false, message: "Weekly off day" });
    }

    // إذا كان جدول اليوم عبارة عن استراحة كاملة (بدء وانتهاء "00:00:00")
    if (
      daySchedule.startTime === "00:00:00" &&
      daySchedule.endTime === "00:00:00"
    ) {
      return res.json({ success: false, message: "Break time" });
    }

    // التحقق من العطلات الرسمية لهذا اليوم
    const OfficialHoliday = require("../models/OfficialHoliday");
    const holiday = await OfficialHoliday.findOne({
      holiday_date: { $eq: localDate },
      owner: req.userId,
    }).lean();
    if (holiday) {
      return res.json({ success: false, message: "Official holiday" });
    }

    // التحقق من الإجازات (يوم إجازة) لهذا الموظف
    const Vacation = require("../models/Vacation");
    const vacation = await Vacation.findOne({
      enroll_id: employee_id,
      vacation_start_date: { $lte: localDate },
      vacation_end_date: { $gte: localDate },
      status: "Approved",
    }).lean();
    if (vacation) {
      return res.json({ success: false, message: "Vacation day" });
    }

    // استخدام الدالة الموجودة localTimeToUTC لتحويل أوقات الجدول إلى UTC
    // نفترض أن الدالة localTimeToUTC معرفة في نفس الملف كما في باقي الكود
    const scheduledStartUTC = localTimeToUTC(
      localDate,
      daySchedule.startTime,
      timeZone
    );
    let regStartUTC = null;
    if (daySchedule.work_registration_start_time) {
      regStartUTC = localTimeToUTC(
        localDate,
        daySchedule.work_registration_start_time,
        timeZone
      );
    }
    let lastEntryPreventionUTC = null;
    if (daySchedule.last_entry_prevention_time) {
      lastEntryPreventionUTC = localTimeToUTC(
        localDate,
        daySchedule.last_entry_prevention_time,
        timeZone
      );
    }

    // التحقق من أن الوقت المقدم يقع ضمن فترة الحضور المسموح بها
    if (regStartUTC && checkTimeUTC < regStartUTC) {
      return res.json({
        success: false,
        message: "Time not allowed: too early",
      });
    }
    if (lastEntryPreventionUTC && checkTimeUTC > lastEntryPreventionUTC) {
      return res.json({
        success: false,
        message: "Time not allowed: too late for entry",
      });
    }

    // إذا تجاوزت جميع الشروط، يتم قبول البصمة
    return res.json({
      success: true,
      message: "Fingerprint accepted successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDashboardMetrics = async (req, res) => {
  try {
    // استقبال فترة الزمن من باراميترات الاستعلام (Query Parameters)
    let {
      start_date = "2025-03-01",
      end_date = "2025-03-31",
      timeZone = "Asia/Baghdad",
    } = req.query;

    // تحويلها إلى Date
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // 1) إجمالي عدد الموظفين
    const totalEmployees = await Employee.countDocuments({ owner: req.userId });

    // 2) إجمالي عدد الأقسام
    const totalDepartments = await Department.countDocuments({
      owner: req.userId,
    });

    // 3) إجمالي عدد العطلات الرسمية في الفترة
    const totalHolidays = await OfficialHoliday.countDocuments({
      owner: req.userId,
      holiday_date: { $gte: startDate, $lte: endDate },
    });

    // 4) عدد الإجازات ذات الـ status="Pending" ضمن الفترة
    const pendingLeaves = await Vacation.countDocuments({
      owner: req.userId,
      status: "Pending",
      $or: [
        {
          vacation_start_date: {
            $gte: startDate,
            $lte: endDate,
          },
        },
        {
          vacation_end_date: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      ],
    });

    // ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
    //     حساب بعض مؤشرات الحضور (غياب/تأخير/أوفر تايم ...) — مثال مبسط
    // ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ

    // 1) جلب الموظفين
    const employees = await Employee.find({ owner: req.userId }).lean();

    // 2) بناء قائمة الأيام من startDate حتى endDate
    const daysArray = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      daysArray.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    let totalLate = 0;
    let totalAbsent = 0;
    let totalOvertime = 0;
    let totalLeavesApproved = 0; // إجازات Approved فقط
    // توزيع حالات الحضور
    let attendanceDistribution = {
      present: 0,
      absent: 0,
      late: 0,
      early_exit: 0,
      overtime: 0,
      other: 0,
    };

    // monthlyStats: [{"date": "...", "attendanceCount": number}, ...]
    let monthlyStatsMap = {};

    // جلب الإجازات المعتمدة
    const approvedVacations = await Vacation.find({
      owner: req.userId,
      status: "Approved",
      vacation_start_date: { $lte: endDate },
      vacation_end_date: { $gte: startDate },
    }).lean();

    // حفظها في خريطة vacationsMap[enrollId][dateStr] = true
    let vacationsMap = {};
    for (let v of approvedVacations) {
      let startV = new Date(v.vacation_start_date);
      let endV = new Date(v.vacation_end_date);
      for (let d = new Date(startV); d <= endV; d.setDate(d.getDate() + 1)) {
        if (d < startDate || d > endDate) continue; // فقط ضمن نطاق التقرير
        let dateStr = d.toISOString().split("T")[0];
        let eId = v.enroll_id;
        if (!vacationsMap[eId]) {
          vacationsMap[eId] = {};
        }
        vacationsMap[eId][dateStr] = true;
      }
    }

    // جمع بصمات الفترة
    const fingerLogs = await FingerPrintLog.find({
      owner: req.userId,
      time: { $gte: startDate, $lte: endDate },
    }).lean();

    // تشكيل خريطة logsMap[enrollid][dateStr] = [fingerLog1, ...]
    let logsMap = {};
    for (let f of fingerLogs) {
      let eId = f.enrollid;
      let dateStr = new Date(f.time).toISOString().split("T")[0];
      if (!logsMap[eId]) logsMap[eId] = {};
      if (!logsMap[eId][dateStr]) logsMap[eId][dateStr] = [];
      logsMap[eId][dateStr].push(f);
    }

    // المرور على كل موظف + كل يوم
    for (let emp of employees) {
      for (let dObj of daysArray) {
        let dateStr = dObj.toISOString().split("T")[0];

        // خارج تاريخ المباشرة/ترك العمل
        if (emp.joining_date && dObj < new Date(emp.joining_date)) continue;
        if (emp.leave_date && dObj > new Date(emp.leave_date)) continue;

        // هل اليوم إجازة معتمدة؟
        const isVacationDay =
          vacationsMap[emp.enroll_id] && vacationsMap[emp.enroll_id][dateStr];

        if (isVacationDay) {
          totalLeavesApproved++;
          attendanceDistribution.other++; // أو عدّه vacation
          // نعده حضور (من حيث إحصاء الأفراد في ذلك اليوم)
          if (!monthlyStatsMap[dateStr]) {
            monthlyStatsMap[dateStr] = { attendanceCount: 0 };
          }
          monthlyStatsMap[dateStr].attendanceCount++;
          continue;
        }

        // بصمات اليوم
        let dayLogs = logsMap[emp.enroll_id]
          ? logsMap[emp.enroll_id][dateStr] || []
          : [];

        // إذا لا بصمات => غياب
        if (dayLogs.length === 0) {
          totalAbsent++;
          attendanceDistribution.absent++;
          continue;
        }

        // تبسيط: إذا أول بصمة بعد 08:00 => متأخر
        dayLogs.sort((a, b) => new Date(a.time) - new Date(b.time));
        let firstLog = new Date(dayLogs[0].time);
        let hours = firstLog.getHours();
        let minutes = firstLog.getMinutes();
        let isLate = false;
        if (hours > 8 || (hours === 8 && minutes > 0)) {
          isLate = true;
        }

        // تبسيط: إذا آخر بصمة بعد 17:00 => أوفر تايم
        let lastLog = new Date(dayLogs[dayLogs.length - 1].time);
        let lh = lastLog.getHours();
        let isOvertime = lh >= 17;
        // تبسيط: إن كانت آخر بصمة قبل 15 => خروج مبكر
        let isEarly = lh < 15;

        if (isLate) {
          totalLate++;
          attendanceDistribution.late++;
        } else if (isEarly) {
          attendanceDistribution.early_exit++;
        } else if (isOvertime) {
          totalOvertime++;
          attendanceDistribution.overtime++;
        } else {
          attendanceDistribution.present++;
        }

        // لإحصاء الحضور الإجمالي في هذا اليوم
        if (!monthlyStatsMap[dateStr]) {
          monthlyStatsMap[dateStr] = { attendanceCount: 0 };
        }
        monthlyStatsMap[dateStr].attendanceCount++;
      }
    }

    // تحويل monthlyStatsMap -> مصفوفة
    let monthlyStats = Object.keys(monthlyStatsMap)
      .sort()
      .map((dt) => ({
        date: dt,
        attendanceCount: monthlyStatsMap[dt].attendanceCount,
      }));

    // أحدث 5 بصمات
    const latestFingerLogs = await FingerPrintLog.find({ owner: req.userId })
      .sort({ time: -1 })
      .limit(5)
      .lean();

    // أحدث 5 إجازات انتظار
    const latestPendingLeaves = await Vacation.find({
      owner: req.userId,
      status: "Pending",
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // أقرب 5 عطل قادمة
    const upcomingHolidays = await OfficialHoliday.find({
      owner: req.userId,
      holiday_date: { $gt: startDate },
    })
      .sort({ holiday_date: 1 })
      .limit(5)
      .lean();

    const responseData = {
      totalEmployees,
      totalDepartments,
      totalHolidays,
      pendingLeaves,
      totalLate,
      totalAbsent,
      totalOvertime,
      totalLeaves: totalLeavesApproved,
      attendanceDistribution,
      monthlyStats,
      lateOvertimeEarly: {
        late: totalLate,
        overtime: totalOvertime,
        earlyExit: attendanceDistribution.early_exit,
      },
      latestFingerLogs,
      latestPendingLeaves,
      upcomingHolidays,
    };

    return res.json(responseData);
  } catch (error) {
    console.error("Error in getDashboardMetrics:", error);
    return res.status(500).json({
      error: "Failed to retrieve dashboard metrics.",
      details: error.message,
    });
  }
};
