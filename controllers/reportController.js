// controllers/reportController.js

const moment = require("moment-timezone");
const Employee = require("../models/Employee");
const FingerPrintLog = require("../models/FingerPrintLog");
const RewardsAndPenalties = require("../models/RewardsAndPenalties");
const OfficialHoliday = require("../models/OfficialHoliday");
const Vacation = require("../models/Vacation");
const VacationType = require("../models/VacationType");
const TimeBasedLeave = require("../models/TimeBasedLeave");
const StatusName = require("../models/StatusName");
const { ObjectId } = require("mongoose").Types;

// ------------- إضافة الاستدعاءات لمحرك القواعد -------------
const Rule = require("../models/Rule");
const { applyRulesToRecord } = require("../services/ruleEngine");
// -----------------------------------------------------------

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
 * الدالة الرئيسية لحساب التأخير وخروج مبكر
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
    if (!daySchedule.overtime_eligible) {
      // أوّلاً نتحقق إن كان الخروج أكبر من dayEndUTC فنضبطه على dayEndUTC
      if (actualCheckOut > dayEndUTC) {
        actualCheckOut = dayEndUTC;
      }

      // ثانيًا إذا كان أصغر من firstExitUTC أو أكبر من lastExitUTC نجعله null
      if (firstExitUTC && actualCheckOut < firstExitUTC) {
        actualCheckOut = null;
      }
      if (lastExitUTC && actualCheckOut > lastExitUTC) {
        actualCheckOut = null;
      }
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
    finalStatus = dmins > 0 ? "late" : "semi_present";
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

/** التقرير */
exports.getFullAttendanceReport = async (req, res) => {
  try {
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
      status_code,
    } = req.query;

    // إن كان المستخدم الموظف نفسه
    if (req.employee) {
      employee_id = req.employee.enroll_id;
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // فلترة موظف
    const empMatch = {};
    if (+employee_id !== 0) empMatch.enroll_id = +employee_id;
    if (department_id && department_id !== "0") {
      empMatch.department_id = new ObjectId(department_id);
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
    if (+employee_id !== 0) fingerMatch.enrollid = +employee_id;
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
    if (+employee_id !== 0) vacMatch.enroll_id = +employee_id;
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
    if (+employee_id !== 0) tblMatch.enroll_id = +employee_id;
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
            };
          }
        }
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

          // طباعة معلومات الشفت في الـ console:
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
              endDayOffset: ts.offset || 0,

              work_registration_start_time: ts.workRegistrationStartTime,
              last_entry_prevention_time: ts.lastEntryPreventionTime,
              overtimeStart: ts.overtimeStartTime,

              official_working_hours: ts.officialWorkingHours || 8,
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
            };
          }
        }
        // ====================================
        if (!daySchedule) {
          daySchedule = emp.weekSchedules?.find((ws) => ws.day === dayName);
        }

        let record = {
          enroll_id: emp.enroll_id,
          employee_name: emp.name,
          department_id: emp.department_id ? emp.department_id._id : null,
          department_name: emp.department,
          attendance_date: dateStr,
          day: dayName,
          dynamic_hour_price:
            emp.main_salary &&
            empWorkingDays &&
            daySchedule &&
            daySchedule.official_working_hours
              ? emp.main_salary /
                empWorkingDays /
                daySchedule.official_working_hours
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
          hour_price: daySchedule?.hourPrice || 0,
          overtime_price: daySchedule?.overtimePrice || 0,
          works_for_daily_wage: daySchedule?.works_for_daily_wage || false,
          official_working_hours: daySchedule?.official_working_hours || 8,
          endDayOffset: daySchedule?.endDayOffset || 0,

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

        // لو لا يوجد جدولة لهذا اليوم => عطلة أسبوعية
        if (!daySchedule) {
          if (+show_weekly_off_days === 1) {
            record.status_code = "week_work_off";
            // طباعة نتيجة اليوم
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
            record.net_salary = daySchedule.daily_salary;
          }
          // طباعة نتيجة اليوم
          console.log("[DEBUG RESULT - يوم راحة كامل]", record);
          finalResults.push(record);
          continue;
        }

        // حساب الـ UTC
        let dayStartUTC = localTimeToUTC(
          dateObj,
          daySchedule.startTime,
          timeZone
        );
        let dayEndUTC = localTimeToUTC(dateObj, daySchedule.endTime, timeZone);
        let offset = daySchedule.endDayOffset || 0;
        if (offset > 0) {
          dayEndUTC = new Date(dayEndUTC.getTime() + offset * 24 * 3600 * 1000);
        }

        let wrStartUTC = null;
        if (daySchedule.work_registration_start_time) {
          wrStartUTC = localTimeToUTC(
            dateObj,
            daySchedule.work_registration_start_time,
            timeZone
          );
        }

        let overtimeStartUTC = null;
        if (daySchedule.overtimeStart) {
          overtimeStartUTC = localTimeToUTC(
            dateObj,
            daySchedule.overtimeStart,
            timeZone
          );
          daySchedule.overtimeStartUTC = overtimeStartUTC;
        }

        let lastEntryPreventionUTC = null;
        if (daySchedule.last_entry_prevention_time) {
          lastEntryPreventionUTC = localTimeToUTC(
            dateObj,
            daySchedule.last_entry_prevention_time,
            timeZone
          );
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
        }
        if (daySchedule.last_exit_allowed_time) {
          lastExitUTC = localTimeToUTC(
            dateObj,
            daySchedule.last_exit_allowed_time,
            timeZone
          );
        }

        // تطبيق offset على الأوقات الأخرى
        if (offset > 0) {
          if (lastEntryPreventionUTC) {
            lastEntryPreventionUTC = new Date(
              lastEntryPreventionUTC.getTime() + offset * 24 * 3600 * 1000
            );
            daySchedule.lastEntryPreventionUTC = lastEntryPreventionUTC;
          }
          if (overtimeStartUTC) {
            overtimeStartUTC = new Date(
              overtimeStartUTC.getTime() + offset * 24 * 3600 * 1000
            );
            daySchedule.overtimeStartUTC = overtimeStartUTC;
          }
          if (firstExitUTC) {
            firstExitUTC = new Date(
              firstExitUTC.getTime() + offset * 24 * 3600 * 1000
            );
          }
          if (lastExitUTC) {
            lastExitUTC = new Date(
              lastExitUTC.getTime() + offset * 24 * 3600 * 1000
            );
          }
        }

        // فلترة البصمات
        let dayFingerLogs = fingerLogs
          .filter((f) => {
            if (f.enrollid !== emp.enroll_id) return false;
            let fTime = new Date(f.time);
            if (wrStartUTC && fTime < wrStartUTC) return false;
            // بقية الفلترة بتوقيت اليوم
            return fTime <= Math.max(dayEndUTC, lastExitUTC || dayEndUTC);
          })
          .sort((a, b) => new Date(a.time) - new Date(b.time));

        // الاستراحات
        let logsEvent3 = dayFingerLogs.filter((x) => x.event === 3);
        let logsEvent4 = dayFingerLogs.filter((x) => x.event === 4);
        let restBreaks = matchMultipleBreaks(logsEvent3, logsEvent4);

        // checkIn, checkOut
        let checkInUTC = null,
          checkOutUTC = null;

        // المرحلة الأولى: نبحث فقط في السجلات التي تكون قيمتها event 1 أو 2
        let primaryLogs = dayFingerLogs.filter(
          (x) => x.event === 1 || x.event === 2
        );

        if (primaryLogs.length > 0) {
          // البحث عن تسجيل الدخول من خلال الحدث 1
          let login = primaryLogs.find((x) => x.event === 1);
          if (login) {
            checkInUTC = login.time;
          }

          // البحث عن تسجيل الخروج من خلال الحدث 2 (نأخذ آخر سجل في حالة تكرارها)
          let logoutLogs = primaryLogs.filter((x) => x.event === 2);
          if (logoutLogs.length > 0) {
            checkOutUTC = logoutLogs[logoutLogs.length - 1].time;
          }
        }

        // المرحلة الثانية (fallback): إذا لم نحصل على تسجيل دخول أو خروج نستخدم السجلات التي لا تكون event قيمتها 3 أو 4 أو 5
        if (checkInUTC === null || checkOutUTC === null) {
          let fallbackLogs = dayFingerLogs.filter(
            (x) => ![3, 4, 5].includes(x.event)
          );
          if (fallbackLogs.length > 0) {
            if (checkInUTC === null) {
              // أول بصمة تعتبر دخولاً
              checkInUTC = fallbackLogs[0].time;
            }
            if (checkOutUTC === null && fallbackLogs.length >= 2) {
              // آخر بصمة تعتبر خروجاً (نتأكد من وجود أكثر من سجل وأنها ليست متطابقة)
              let firstT = fallbackLogs[0].time;
              let lastT = fallbackLogs[fallbackLogs.length - 1].time;
              if (lastT !== firstT) {
                checkOutUTC = lastT;
              }
            }
          }
        }

        // تعديل timeBasedLeaves
        let partial = timeBasedLeaves.find((tb) => {
          let tbDate = new Date(tb.leave_date).toISOString().split("T")[0];
          return tb.enroll_id === emp.enroll_id && tbDate === dateStr;
        });
        if (partial) {
          if (checkInUTC && partial.leave_duration_for_entry) {
            let cIn = new Date(checkInUTC);
            cIn.setMinutes(cIn.getMinutes() - partial.leave_duration_for_entry);
            checkInUTC = cIn;
          }
          if (checkOutUTC && partial.leave_duration_for_exit) {
            let cOut = new Date(checkOutUTC);
            cOut.setMinutes(
              cOut.getMinutes() + partial.leave_duration_for_exit
            );
            checkOutUTC = cOut;
          }
        }

        // مكافآت / جزاءات
        let rpItems = rpData.filter((r) => {
          let rDate = new Date(r.date).toISOString().split("T")[0];
          return r.enroll_id === emp.enroll_id && rDate === dateStr;
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
            v.enroll_id === emp.enroll_id &&
            new Date(v.vacation_start_date) <= dateObj &&
            new Date(v.vacation_end_date) >= dateObj
        );

        if (holidayDoc) {
          record.status_code = "holiday";
        } else if (foundVacation) {
          if (foundVacation.status === "Pending") {
            // يوم عمل لكن الإجازة لم تُوافق
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
            record.status_code = metrics.statusCode;
            record.work_hours = +metrics.workHours.toFixed(2);
            record.check_in = metrics.finalCheckIn
              ? utcToLocalString(metrics.finalCheckIn, timeZone)
              : null;
            record.check_out = metrics.finalCheckOut
              ? utcToLocalString(metrics.finalCheckOut, timeZone)
              : null;
            record.base_work_hours = +metrics.baseWork.toFixed(2);
          } else {
            // إجازة مصدّقة
            let vacName = foundVacation.vacation_type_id?.vacation_name || "";
            if (foundVacation.status === "Approved") {
              if (vacName.includes("مرضية")) {
                record.status_code = "sick_leave";
              } else if (vacName.includes("سنوية")) {
                record.status_code = "annual_leave";
              } else {
                record.status_code = foundVacation.reason;
              }
              if (foundVacation.is_paid) {
                record.work_hours = daySchedule.official_working_hours;
              }
            } else if (foundVacation.status === "Pending") {
              record.status_code = "أجازة انتظار";
            }
            record.check_in = null;
            record.check_out = null;
            record.base_work_hours = 0;
          }

          record.is_vacation_day = true;
          record.is_paid_vacation = !!foundVacation.is_paid;
          record.vacation_status = foundVacation.status;
        } else {
          // يوم عمل عادي
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
          record.status_code = metrics.statusCode;
          record.work_hours = +metrics.workHours.toFixed(2);
          record.check_in = metrics.finalCheckIn
            ? utcToLocalString(metrics.finalCheckIn, timeZone)
            : null;
          record.check_out = metrics.finalCheckOut
            ? utcToLocalString(metrics.finalCheckOut, timeZone)
            : null;
          record.base_work_hours = +metrics.baseWork.toFixed(2);

          // أوفر تايم
          let otRate =
            daySchedule.overtime_price || daySchedule.overtimePrice || 0;
          let overtimeHours = record.overtime_minutes / 60;
          let overtimeValue = overtimeHours * otRate;
          record.overtime_entitlement = +overtimeValue.toFixed(2);

          record.is_vacation_day = false;
          record.is_paid_vacation = false;
          record.vacation_status = null;
        }

        if (partial) {
          record.leave_duration_for_entry =
            partial.leave_duration_for_entry || 0;
          record.leave_duration_for_exit = partial.leave_duration_for_exit || 0;
        } else {
          record.leave_duration_for_entry = 0;
          record.leave_duration_for_exit = 0;
        }

        // جمع الاستراحات للعرض
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

        // دقائق الاستراحة
        const allowedMinRest = daySchedule.allowed_min_rest || 0;
        const restMinPrices = daySchedule.rest_min_prices || 0;
        const totalRestMinutes = totalR * 60;
        record.total_rest_minutes = Math.round(totalRestMinutes);
        let restCutting = 0;
        if (totalRestMinutes > allowedMinRest) {
          const diff = totalRestMinutes - allowedMinRest;
          restCutting = diff * restMinPrices;
        }
        record.rest_cutting = restCutting;

        // الحساب المالي (الراتب قبل القواعد)
        if (record.status_code === "absent") {
          record.absent_cutting = daySchedule.absent_cutting || 0;
        }
        if (
          daySchedule.works_for_daily_wage &&
          ![
            "holiday",
            "annual_leave",
            "sick_leave",
            "other_leave",
            "absent",
            "rest_day",
          ].includes(record.status_code)
        ) {
          record.salary_earned_for_work = daySchedule.daily_salary || 0;
        } else if (
          !daySchedule.works_for_daily_wage &&
          ![
            "holiday",
            "annual_leave",
            "sick_leave",
            "other_leave",
            "absent",
            "rest_day",
          ].includes(record.status_code)
        ) {
          record.salary_earned_for_work =
            record.work_hours *
            (daySchedule.hour_price || daySchedule.hourPrice || 0);
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

        // حساب أولي للراتب الصافي
        let netVal =
          record.salary_earned_for_work +
          record.overtime_entitlement -
          restCutting -
          record.late_arrival_deduction -
          record.early_exit_deduction -
          record.absent_cutting -
          record.late_cutting_by_count -
          record.early_cutting_by_count +
          rpAmount;

        record.net_salary_before_rounding = netVal;
        record.net_salary = netVal;

        if (
          !holidayDoc &&
          daySchedule.startTime !== "00:00:00" &&
          daySchedule.endTime !== "00:00:00"
        ) {
          sumRequiredWorkHours += daySchedule.official_working_hours || 8;
        }

        // طباعة السجل (اليوم) النهائي للموظف
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

    // تجهيز سطر الملخص للعرض
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
        ` | ساعات العمل المطلوبة=${sumRequiredWorkHours}`,
      attendance_date: null,
      // إضافة اليوم في الملخص ليس ضروريًا، نجعله فارغًا
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

    return res.json(finalResults);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error generating attendance report",
      details: err.message,
    });
  }
};
