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

/** جمع الاستراحات (event=4 => event=5) */
function matchMultipleBreaks(e4, e5) {
  let restBreaks = [];
  let j = 0;
  for (let i = 0; i < e4.length; i++) {
    let rIn = new Date(e4[i].time); // UTC
    while (j < e5.length) {
      let rOut = new Date(e5[j].time);
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
  dayStartUTC, // startTime UTC (مثلا 09:00 محلي => 06:00 UTC)
  dayEndUTC, // endTime UTC (17:00 محلي => 14:00 UTC) مع إضافة endDayOffset إن وجد
  workRegStartUTC, // 08:00 محلي => 05:00 UTC (قبله نهمل البصمة)
  firstExitUTC, // 15:00 محلي => 12:00 UTC
  lastExitUTC, // 20:00 محلي => 17:00 UTC
  lastEntryPreventionUTC,
  overtimeStartUTC,
}) {
  let delayMinutes = 0,
    earlyExitMinutes = 0,
    overtimeMinutes = 0;
  let statusCode = "absent";
  let workHours = 0;

  // نُعرّف متغيرين لوقت الدخول النهائي والخروج النهائي
  // (وسنُعيدهما ضمن return)
  let actualCheckIn = checkInUTC ? new Date(checkInUTC) : null;
  let actualCheckOut = checkOutUTC ? new Date(checkOutUTC) : null;
  // لغرض السمري  لحساب ساعات العمل الأساسية قبل طرح الاستراحات
  let baseWork = 0;
  if (actualCheckIn && actualCheckOut) {
    baseWork = (actualCheckOut - actualCheckIn) / (1000 * 3600);
    if (baseWork < 0) baseWork = 0;
  }
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
      // لو يوجد first_exit_allowed_time, last_exit_allowed_time
      // إن كان checkOut < firstExitUTC => نعتبره لا خروج
      if (firstExitUTC && actualCheckOut < firstExitUTC) {
        actualCheckOut = null;
      }
      if (lastExitUTC && actualCheckOut > lastExitUTC) {
        actualCheckOut = null;
      }
      if (actualCheckOut && actualCheckOut > dayEndUTC) {
        actualCheckOut = dayEndUTC;
      }
    }
    // إذا كان overtime_eligible = true، لا نغير actualCheckOut
  }

  // طرح الاستراحات
  let totalRest = 0;
  for (let b of restBreaks) {
    let dur = (b.rest_out - b.rest_in) / (1000 * 3600);
    if (dur < 0) dur = 0;
    totalRest += dur;
  }
  let finalWorkHours = baseWork - totalRest + daySchedule.allowed_min_rest / 60;

  // إن كان الموظف مؤهلًا للأوفر تايم
  if (daySchedule.overtime_eligible) {
    // الفارق بين finalWorkHours وساعات العمل الرسمية
    let otHours = finalWorkHours - (daySchedule.official_working_hours || 8);

    // لا نحتسب الأوفر تايم إلا إذا تجاوز الموظف ساعات العمل الرسمية
    if (otHours > 0) {
      // يمكن أيضًا اشتراط وصوله إلى حد أدنى من الساعات (مثلاً 10 ساعات)
      // إذا تم تحديد minimum_working_hours_overtime في daySchedule
      if (
        daySchedule.minimum_working_hours_overtime &&
        finalWorkHours < daySchedule.minimum_working_hours_overtime
      ) {
        overtimeMinutes = 0;
      } else {
        // تأكدنا أيضًا من شرط:
        if (overtimeStartUTC && actualCheckOut < overtimeStartUTC) {
          // إن كان الخروج قبل وقت بدء الأوفر تايم لا يوجد أوفر تايم
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
  // إن كان لم يخرج => no exit
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

  // هنا نُعيد قيمة actualCheckIn, actualCheckOut النهائية مع بقية المؤشرات
  return {
    delayMinutes: dmins,
    earlyExitMinutes: emins,
    overtimeMinutes,
    statusCode: finalStatus,
    workHours: finalWorkHours,
    // تمّت إضافتهما هنا:
    finalCheckIn: actualCheckIn,
    finalCheckOut: actualCheckOut,
    baseWork,
  };
}

/** التقرير */
exports.getFullAttendanceReport = async (req, res) => {
  try {
    const {
      start_date = "2025-02-01",
      end_date = "2025-02-05",
      employee_id = 0,
      department_id = 0,
      show_official_holidays = 1,
      show_weekly_off_days = 1,
      timeZone = req.user.timeZone,
      status_code,
    } = req.query;

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // فلترة موظف
    const empMatch = {};
    if (+employee_id !== 0) empMatch.enroll_id = +employee_id;
    if (department_id && department_id !== "0") {
      empMatch.department_id = new ObjectId(department_id);
    }

    //const employees = await Employee.find(empMatch).lean();
    //if (!employees.length) return res.json([]);
    const employees = await Employee.find({ ...empMatch, owner: req.userId })
      .populate("department_id", "department") // أو أي حقل آخر يُخزن اسم القسم
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

    // العطلات
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

    // مكافآت
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
    for (const emp of employees) {
      for (const dateObj of allDates) {
        const dateStr = dateObj.toISOString().split("T")[0];
        if (emp.joining_date && dateObj < new Date(emp.joining_date)) continue;
        if (emp.leave_date && dateObj > new Date(emp.leave_date)) continue;

        let dayIndex = dateObj.getDay();
        let dayName = dayNameMap[dayIndex];

        let daySchedule = emp.weekSchedules?.find((ws) => ws.day === dayName);
        let record = {
          enroll_id: emp.enroll_id,
          employee_name: emp.name,
          department_id: emp.department_id ? emp.department_id._id : null,
          department_name: emp.department,
          attendance_date: dateStr,

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

        if (!daySchedule) {
          // عطلة اسبوعية
          if (+show_weekly_off_days === 1) {
            record.status_code = "week_work_off";
            finalResults.push(record);
          }
          continue;
        }

        // يوم راحة كامل
        if (
          daySchedule.startTime === "00:00:00" &&
          daySchedule.endTime === "00:00:00"
        ) {
          record.status_code = "أستراحة";
          if (daySchedule.daily_salary > 0) {
            record.net_salary = daySchedule.daily_salary;
          }
          finalResults.push(record);
          continue;
        }

        // تحويل start/end => UTC
        let dayStartUTC = localTimeToUTC(
          dateObj,
          daySchedule.startTime,
          timeZone
        );
        let dayEndUTC = localTimeToUTC(dateObj, daySchedule.endTime, timeZone);

        // لو عندك endDayOffset
        let offset = daySchedule.endDayOffset || 0;
        if (offset > 0) {
          dayEndUTC = new Date(dayEndUTC.getTime() + offset * 24 * 3600 * 1000);
        }

        // work_registration_start_time => UTC
        let wrStartUTC = null;
        if (daySchedule.work_registration_start_time) {
          wrStartUTC = localTimeToUTC(
            dateObj,
            daySchedule.work_registration_start_time,
            timeZone
          );
        }

        // overtimeStartUTC
        let overtimeStartUTC = null;
        if (daySchedule.overtimeStart) {
          overtimeStartUTC = localTimeToUTC(
            dateObj,
            daySchedule.overtimeStart,
            timeZone
          );
          daySchedule.overtimeStartUTC = overtimeStartUTC;
        }

        // lastEntryPreventionUTC
        let lastEntryPreventionUTC = null;
        if (daySchedule.last_entry_prevention_time) {
          lastEntryPreventionUTC = localTimeToUTC(
            dateObj,
            daySchedule.last_entry_prevention_time,
            timeZone
          );
          daySchedule.lastEntryPreventionUTC = lastEntryPreventionUTC;
        }

        // first_exit_allowed_time => UTC
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

        // (التعديل الجديد) إضافة الـ offset على الأوقات الأخرى إذا وجد endDayOffset:
        if (offset > 0) {
          if (lastEntryPreventionUTC) {
            lastEntryPreventionUTC = new Date(
              lastEntryPreventionUTC.getTime() + offset * 24 * 3600 * 1000
            );
          }

          if (offset > 0 && overtimeStartUTC) {
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
        // نهاية التعديل

        // فلترة البصمات
        let dayFingerLogs = fingerLogs
          .filter((f) => {
            if (f.enrollid !== emp.enroll_id) return false;
            let fTime = new Date(f.time); // UTC
            // اهمال البصمات قبل work_registration_start_time
            if (wrStartUTC && fTime < wrStartUTC) {
              return false;
            }
            // سنترك التعامل مع بصمات الخروج بعد lastExitUTC للدالة نفسها
            return fTime <= Math.max(dayEndUTC, lastExitUTC || dayEndUTC);
          })
          .sort((a, b) => new Date(a.time) - new Date(b.time));

        // الاستراحات
        let logsE4 = dayFingerLogs.filter((x) => x.event === 4);
        let logsE5 = dayFingerLogs.filter((x) => x.event === 5);
        let restBreaks = matchMultipleBreaks(logsE4, logsE5);

        // checkIn, checkOut
        let checkInUTC = null,
          checkOutUTC = null;
        let e2 = dayFingerLogs.filter((x) => x.event === 2);
        if (e2.length) checkInUTC = e2[0].time;
        let e3 = dayFingerLogs.filter((x) => x.event === 3);
        if (e3.length) checkOutUTC = e3[e3.length - 1].time;

        // fallback event=1
        if (!checkInUTC) {
          let e1 = dayFingerLogs.filter((x) => x.event === 1);
          if (e1.length) {
            checkInUTC = e1[0].time;
          }
        }
        if (!checkOutUTC) {
          let e1 = dayFingerLogs.filter((x) => x.event === 1);
          if (e1.length >= 2) {
            let firstT = e1[0].time;
            let lastT = e1[e1.length - 1].time;
            if (lastT !== firstT) {
              checkOutUTC = lastT;
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

        // إجازة يومية
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
              record.status_code = "أجازة انتظار"; // (إن أردت هذا التصنيف)
            }

            // لا نحتاج لبصمات لأنه يوم إجازة
            record.check_in = null;
            record.check_out = null;
            record.base_work_hours = 0;
          }

          // معلومات للسمري
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

          // أوفر تايم:
          let otRate = daySchedule.overtimePrice || 0;
          let overtimeHours = record.overtime_minutes / 60;
          let overtimeValue = overtimeHours * otRate;
          record.overtime_entitlement = +overtimeValue.toFixed(2);

          // معلومات للسمري
          record.is_vacation_day = false;
          record.is_paid_vacation = false;
          record.vacation_status = null;
        }

        // (بعد إغلاق else، الآن يمكننا تعديل partial وغيره)
        if (partial) {
          record.leave_duration_for_entry =
            partial.leave_duration_for_entry || 0;
          record.leave_duration_for_exit = partial.leave_duration_for_exit || 0;
        } else {
          record.leave_duration_for_entry = 0;
          record.leave_duration_for_exit = 0;
        }

        // الاستراحات للعرض
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

        // 3) حساب دقائق الاستراحة الفعلية
        const allowedMinRest = daySchedule.allowed_min_rest || 0; // عدد الدقائق المسموح بها
        const restMinPrices = daySchedule.rest_min_prices || 0; // سعر خصم الاستراحة لكل دقيقة زائدة
        const totalRestMinutes = totalR * 60;
        record.total_rest_minutes = Math.round(totalRestMinutes); // للعرض إن أردت

        let restCutting = 0;

        if (totalRestMinutes > allowedMinRest) {
          const diff = totalRestMinutes - allowedMinRest;
          restCutting = diff * restMinPrices;
        }

        // تخزينه في الحقل الجديد
        record.rest_cutting = restCutting;

        // الحساب المالي
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
            record.work_hours * (daySchedule.hourPrice || 0);
        }
        // ... بعد حساب record.overtime_entitlement، وقبل حساب netVal:

        // نفترض أنّ لديك حقولاً في daySchedule لتحديد أسعار الخصم لكل دقيقة أو مبالغ القطع لكل مرة تأخير وخروج مبكر:
        //  - daySchedule.delay_min_price          => سعر الخصم لكل دقيقة تأخير
        //  - daySchedule.early_exit_min_price     => سعر الخصم لكل دقيقة خروج مبكر
        //  - daySchedule.late_cutting_by_count    => مبلغ/نسبة القطع عند التأخير (لكل مرة تأخير)
        //  - daySchedule.early_cutting_by_count   => مبلغ/نسبة القطع عند الخروج المبكر (لكل مرة خروج مبكر)

        // سنقوم بتهيئة قيم الخصم بالدقيقة (إن لم تكن معرّفة في daySchedule فالقيمة 0)
        const delayMinPrice = daySchedule.late_min_prices || 0;
        const earlyExitMinPrice = daySchedule.early_min_prices || 0;
        const lateCountCut = daySchedule.late_cutting_by_count || 0;
        const earlyCountCut = daySchedule.early_cutting_by_count || 0;

        // 1) حساب الخصم حسب عدد الدقائق (التأخير والخروج المبكر)
        if (record.delay_minutes > 0) {
          // مثال: تأخير 5 دقائق وكل دقيقة تُخصم بقيمة delayMinPrice
          record.late_arrival_deduction = record.delay_minutes * delayMinPrice;
        }

        if (record.early_exit_minutes > 0) {
          // مثال: خروج مبكر 10 دقائق وكل دقيقة تُخصم بقيمة earlyExitMinPrice
          record.early_exit_deduction =
            record.early_exit_minutes * earlyExitMinPrice;
        }

        // 2) حساب الخصم حسب عدد المرات (مرة تأخير أو مرة خروج مبكر)
        if (record.delay_minutes > 0) {
          // لو تريده خصمًا ثابتًا عند حدوث التأخير (مرة واحدة في اليوم):
          record.late_cutting_by_count = lateCountCut;
        }

        if (record.early_exit_minutes > 0) {
          // نفس المنطق للـخروج المبكر
          record.early_cutting_by_count = earlyCountCut;
        }

        // الآن نُعيد حساب netVal بعد إضافة خصومات الدقائق وعدد المرات:

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
          sumRequiredWorkHours += daySchedule.official_working_hours || 0;
        }
        finalResults.push(record);
      }
    }

    // ترتيب
    finalResults.sort((a, b) => {
      let d1 = (a.attendance_date || "").localeCompare(b.attendance_date || "");
      if (d1 !== 0) return d1;
      return (a.employee_name || "").localeCompare(b.employee_name || "");
    });

    // تبديل status_code بالاسم
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

    // ملخص
    let sumDelay = 0,
      sumEarly = 0,
      sumOT = 0,
      sumAbs = 0,
      sumRewards = 0,
      sumPenalties = 0,
      sumNet = 0;
    let sumTotalRestDuration = 0; // مجموع الاستراحات (بالساعات)
    let sumBaseWork = 0; // مجموع ساعات العمل الأساسية (baseWork)
    let countPaidLeaves = 0; // عدد الإجازات المدفوعة
    let countUnpaidLeaves = 0; // عدد الإجازات غير المدفوعة
    let countPendingLeaves = 0; // عدد الإجازات الانتظار
    let countTimeBasedLeaves = 0; // عدد الإجازات الزمنية
    let totalEntryLeaveMins = 0; // إجمالي دقائق إجازة الدخول
    let totalExitLeaveMins = 0; // إجمالي دقائق إجازة الخروج
    let sumEntryLeaveMins = 0;
    let sumExitLeaveMins = 0;
    let sumTotalRest = 0;
    let sumDelayMinutes = 0; // مجموع دقائق التأخير
    let sumEarlyExitMinutes = 0; // مجموع دقائق الخروج المبكر
    let lateCount = 0; // عدد مرات التأخير
    let earlyExitCount = 0; // عدد مرات الخروج المبكر
    let officialHolidayCount = 0; // لحساب عدد أيام العطل الرسمية
    let restDayCount = 0; // لحساب عدد أيام الاستراحة (work_off أو أستراحة)
    let workingDayCount = 0; // لحساب عدد أيام العمل الرسمية (كل ما عدا العطل الرسمية وأيام الراحة)
    let week_work_offcount = 0; // لحساب عدد أيام الاستراحة (week_work_off أو أستراحة)

    for (let r of finalResults) {
      // جمع مجموع دقائق التأخير
      sumDelayMinutes += r.delay_minutes || 0;

      // جمع مجموع دقائق الخروج المبكر
      sumEarlyExitMinutes += r.early_exit_minutes || 0;

      // عدّ مرات التأخير
      if ((r.delay_minutes || 0) > 0) lateCount++;

      // عدّ مرات الخروج المبكر
      if ((r.early_exit_minutes || 0) > 0) earlyExitCount++;

      // 1) أيام العطل الرسمية
      if (r.status_code === "holiday") {
        officialHolidayCount++;
      }
      // 1) أيام العطل الاسبوعية
      if (r.status_code === "week_work_off") {
        week_work_offcount++;
      }
      // 2) أيام الاستراحة (work_off أو 'أستراحة')
      else if (r.status_code === "work_off" || r.status_code === "أستراحة") {
        restDayCount++;
      }
      // 3) ما عدا ذلك يُعتبر يوم عمل رسمي سواءً كان حضورًا أو غيابًا
      else {
        // مثل: absent, late, early_exit, present, etc.
        workingDayCount++;
      }
      sumOT += r.overtime_minutes || 0;
      if (r.status_code === "absent") sumAbs++;

      let rpAmt = r.rewards_penalties_amount || 0;
      if (rpAmt > 0) sumRewards += rpAmt;
      else if (rpAmt < 0) sumPenalties += rpAmt;

      sumNet += r.net_salary || 0;

      // تجميع الحقول الجديدة
      sumTotalRestDuration += r.total_rest_duration || 0;
      sumBaseWork += r.base_work_hours || 0;

      // الإجازات اليومية
      if (r.is_vacation_day) {
        if (r.vacation_status === "Approved") {
          if (r.is_paid_vacation) countPaidLeaves++;
          else countUnpaidLeaves++;
        } else if (r.vacation_status === "Pending") {
          countPendingLeaves++;
        }
      }

      // الإجازات الجزئية
      let eM = r.leave_duration_for_entry || 0;
      let xM = r.leave_duration_for_exit || 0;
      if (eM > 0 || xM > 0) countTimeBasedLeaves++;

      sumEntryLeaveMins += eM;
      sumExitLeaveMins += xM;
    }

    let sumRP = sumRewards + sumPenalties; // مجموع المكافآت والجزاءات

    // إنشاء سجل السمري
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
        ` | المجموع الكلي للمكافآت وعقوبات=${sumRP}` +
        ` | صافي=${sumNet.toFixed(2)}` +
        ` | مجموع الاستراحة(ساعة)=${sumTotalRestDuration.toFixed(2)}` +
        ` | ساعات العمل الأساسية=${sumBaseWork.toFixed(2)}` +
        ` | إجازات مدفوعة=${countPaidLeaves}` +
        ` | إجازات غير مدفوعة=${countUnpaidLeaves}` +
        ` | إجازات انتظار=${countPendingLeaves}` +
        ` | إجازات زمنية=${countTimeBasedLeaves}` +
        ` | دقائق اجازات زمنية للدخول=${sumEntryLeaveMins}` +
        ` | دقائق اجازات زمنية للخروج=${sumExitLeaveMins}` +
        ` | اجمالي ايام العطل=${officialHolidayCount}` +
        ` | ايام الاستراحة=${restDayCount}` +
        ` | ايام العمل الرسمية=${workingDayCount}` +
        ` | ايام عطل اسبوعية=${week_work_offcount}` +
        ` | ساعات العمل المطلوبة=${sumRequiredWorkHours}`,
      attendance_date: null,
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

    // -- أضف هنا فلتر الحالة --
    // فقط إن كان هناك status_code نُطبّق الفلتر
    if (status_code) {
      // إذا أردت "استثناء" المُلخص من الفلترة والإبقاء عليه، يمكنك عمل فلتر بحيث لا يزيله:
      finalResults = finalResults.filter((r) => {
        // إن كان الـ status_code في السجل موجودًا ويطابق المطلوب OR السطر هو المُلخص
        return r.status_code === status_code;
      });
    }

    return res.json(finalResults);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error generating attendance report",
      details: err.message,
    });
  }
};
