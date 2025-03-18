// services/flexibleAggregateRules.js
const moment = require("moment-timezone");
const FlexibleAggregateRule = require("../models/FlexibleAggregateRule");

/**
 * دوال المساعدة
 */
function getFrequencyKey(dateStr, frequency, timeZone) {
  const m = moment.tz(dateStr, "YYYY-MM-DD", timeZone);
  if (frequency === "daily") {
    return m.format("YYYY-MM-DD");
  } else if (frequency === "weekly") {
    let year = m.format("GGGG");
    let week = m.format("WW");
    return `${year}-W${week}`;
  } else {
    // monthly
    return m.format("YYYY-MM");
  }
}

function pickDateFromFreqKey(freqKey, frequency) {
  if (frequency === "daily") {
    return freqKey;
  } else if (frequency === "weekly") {
    const [yearPart, wPart] = freqKey.split("-W");
    const weekNum = parseInt(wPart, 10);
    const m = moment().year(yearPart).isoWeek(weekNum).startOf("isoWeek");
    return m.format("YYYY-MM-DD");
  } else {
    // monthly
    return freqKey + "-01";
  }
}

/**
 * الدالة الرئيسية لتطبيق قواعد التجميع
 */
async function applyFlexibleAggregateRules(
  finalResults,
  {
    ownerId,
    reportStartDate,
    reportEndDate,
    timeZone = "Asia/Baghdad",
  }
) {
  // 1) جلب القواعد
  const allRules = await FlexibleAggregateRule.find({
    owner: ownerId,
    // startDate, endDate شروط تداخل الفترة إن أردت
  }).lean();

  if (!allRules.length) {
    return finalResults;
  }

  // 2) بناء المجموعات
  for (let rule of allRules) {
    const {
      applyToAll,
      applyToEmployeeIds,
      applyToDepartmentIds,
      startDate,
      endDate,
      frequency,
      conditionScript,
      actionType,
      actionValue,
      message,
    } = rule;

    let ruleGroups = {};

    // نجمع النتائج حسب الموظف + frequency key
    for (let rec of finalResults) {
      if (!rec.attendance_date) continue;
      const recDate = new Date(rec.attendance_date);
      if (isNaN(recDate.getTime())) continue;

      // تحقق النطاق الزمني
      if (startDate && recDate < startDate) continue;
      if (endDate && recDate > endDate) continue;

      // تحقق من انطباق الموظف/القسم
      let applies = false;
      if (applyToAll) {
        applies = true;
      } else {
        if (applyToEmployeeIds?.length && applyToEmployeeIds.includes(rec.enroll_id)) {
          applies = true;
        }
        if (!applies && applyToDepartmentIds?.length && rec.department_id) {
          for (let depId of applyToDepartmentIds) {
            if (String(depId) === String(rec.department_id)) {
              applies = true;
              break;
            }
          }
        }
      }
      if (!applies) continue;

      const dateStr = rec.attendance_date;
      const freqKey = getFrequencyKey(dateStr, frequency, timeZone);

      if (!ruleGroups[rec.enroll_id]) {
        ruleGroups[rec.enroll_id] = {};
      }
      if (!ruleGroups[rec.enroll_id][freqKey]) {
        ruleGroups[rec.enroll_id][freqKey] = {
          enroll_id: rec.enroll_id,
          employee_name: rec.employee_name,
          department_id: rec.department_id,
          freqKey,
          rows: [],
        };
      }
      ruleGroups[rec.enroll_id][freqKey].rows.push(rec);
    }

    // 3) حساب المتغيرات وتمريرها للشرط
    for (let empId of Object.keys(ruleGroups)) {
      for (let freqKey of Object.keys(ruleGroups[empId])) {
        const groupObj = ruleGroups[empId][freqKey];
        const rows = groupObj.rows || [];

        // حساب جميع المتغيرات
        let tardiesCount = rows.filter((r) => (r.delay_minutes || 0) > 0).length;
        let absentCount = rows.filter((r) => r.status_code === "absent").length;
        let totalDelayMinutes = rows.reduce((acc, r) => acc + (r.delay_minutes || 0), 0);
        let totalEarlyExitMinutes = rows.reduce((acc, r) => acc + (r.early_exit_minutes || 0), 0);
        let totalOvertimeMinutes = rows.reduce((acc, r) => acc + (r.overtime_minutes || 0), 0);
        let leavesCount = rows.filter((r) => !!r.is_vacation_day).length;

        // باقي المتغيرات
        let sumDelayMinutes = totalDelayMinutes;
        let sumEarlyExitMinutes = totalEarlyExitMinutes;
        let sumOT = totalOvertimeMinutes;
        let sumAbs = absentCount;

        let sumRewards = rows.reduce((acc, r) => {
          const val = r.rewards_penalties_amount || 0;
          return val > 0 ? acc + val : acc;
        }, 0);
        let sumPenalties = rows.reduce((acc, r) => {
          const val = r.rewards_penalties_amount || 0;
          return val < 0 ? acc + val : acc;
        }, 0);

        let sumNet = rows.reduce((acc, r) => acc + (r.net_salary || 0), 0);
        let sumTotalRestDuration = rows.reduce((acc, r) => acc + (r.total_rest_duration || 0), 0);
        let sumBaseWork = rows.reduce((acc, r) => acc + (r.base_work_hours || 0), 0);

        let countPaidLeaves = rows.filter((r) => r.is_vacation_day && r.is_paid_vacation).length;
        let countUnpaidLeaves = rows.filter((r) => r.is_vacation_day && !r.is_paid_vacation).length;
        let countPendingLeaves = rows.filter((r) => r.vacation_status === "Pending").length;
        let countTimeBasedLeaves = rows.filter(
          (r) => (r.leave_duration_for_entry || 0) > 0 || (r.leave_duration_for_exit || 0) > 0
        ).length;

        let sumEntryLeaveMins = rows.reduce(
          (acc, r) => acc + (r.leave_duration_for_entry || 0),
          0
        );
        let sumExitLeaveMins = rows.reduce(
          (acc, r) => acc + (r.leave_duration_for_exit || 0),
          0
        );

        let officialHolidayCount = rows.filter((r) => r.status_code === "holiday").length;
        let restDayCount = rows.filter((r) => r.status_code === "rest_day").length;
        let workingDayCount = rows.filter((r) => r.status_code === "present").length;
        let week_work_offcount = rows.filter((r) => r.status_code === "week_work_off").length;
        let sumRequiredWorkHours = rows.reduce((acc, r) => acc + (r.official_working_hours || 0), 0);
        let expectedWorkDays = rows.reduce((acc, r) => {
          if (r.status_code !== "holiday" && r.status_code !== "week_work_off") {
            return acc + 1;
          }
          return acc;
        }, 0);

        // كائن السياق
        const context = {
          tardiesCount,
          absentCount,
          totalDelayMinutes,
          totalEarlyExitMinutes,
          totalOvertimeMinutes,
          leavesCount,
          frequency,

          sumDelayMinutes,
          sumEarlyExitMinutes,
          sumOT,
          sumAbs,
          sumRewards,
          sumPenalties,
          sumNet,
          sumTotalRestDuration,
          sumBaseWork,
          countPaidLeaves,
          countUnpaidLeaves,
          countPendingLeaves,
          countTimeBasedLeaves,
          sumEntryLeaveMins,
          sumExitLeaveMins,
          officialHolidayCount,
          restDayCount,
          workingDayCount,
          week_work_offcount,
          sumRequiredWorkHours,
          expectedWorkDays,
        };

        // تقييم الشرط
        let conditionMet = false;
        try {
          conditionMet = Function(
            ...Object.keys(context),
            `return (${conditionScript});`
          )(...Object.values(context));
        } catch (err) {
          console.error("Error evaluating conditionScript:", err);
          continue;
        }

        // تنفيذ الإجراء
        if (conditionMet) {
          const baseDateStr = pickDateFromFreqKey(freqKey, frequency);
          const baseDate = new Date(baseDateStr);

          if (actionType === "removeAmount") {
            finalResults.push({
              enroll_id: groupObj.enroll_id,
              employee_name: groupObj.employee_name,
              department_id: groupObj.department_id,
              attendance_date: baseDateStr,
              status_code: "RULE_REMOVE_AMOUNT",
              attendance_status: message || "خصم مالي تلقائي",
              net_salary: -(actionValue || 0),
            });
          } else if (actionType === "addAmount") {
            finalResults.push({
              enroll_id: groupObj.enroll_id,
              employee_name: groupObj.employee_name,
              department_id: groupObj.department_id,
              attendance_date: baseDateStr,
              status_code: "RULE_ADD_AMOUNT",
              attendance_status: message || "مكافأة مالية تلقائية",
              net_salary: +(actionValue || 0),
            });
          } else if (actionType === "addDay") {
            const daysToAdd = parseInt(actionValue, 10) || 1;
            for (let i = 0; i < daysToAdd; i++) {
              let dayToAdd = new Date(baseDate.getTime() + i * 24 * 3600 * 1000);
              let dayStr = dayToAdd.toISOString().split("T")[0];
              finalResults.push({
                enroll_id: groupObj.enroll_id,
                employee_name: groupObj.employee_name,
                department_id: groupObj.department_id,
                attendance_date: dayStr,
                status_code: "present",
                attendance_status: message || "إضافة يوم حضور",
                net_salary: 0,
              });
            }
          } else if (actionType === "removeDay") {
            const daysToRemove = parseInt(actionValue, 10) || 1;
            for (let i = 0; i < daysToRemove; i++) {
              let dayToRemove = new Date(baseDate.getTime() + i * 24 * 3600 * 1000);
              let dayStr = dayToRemove.toISOString().split("T")[0];
              finalResults.push({
                enroll_id: groupObj.enroll_id,
                employee_name: groupObj.employee_name,
                department_id: groupObj.department_id,
                attendance_date: dayStr,
                status_code: "absent",
                attendance_status: message || "إزالة يوم حضور (غياب)",
                net_salary: 0,
              });
            }
          }
        }
      }
    }
  }

  // إعادة ترتيب finalResults إذا أردت
  finalResults.sort((a, b) => {
    if (!a.attendance_date || !b.attendance_date) return 0;
    let d1 = a.attendance_date.localeCompare(b.attendance_date);
    if (d1 !== 0) return d1;
    return (a.employee_name || "").localeCompare(b.employee_name || "");
  });

  return finalResults;
}

// أخيرًا نقوم بالتصدير
module.exports = {
  applyFlexibleAggregateRules,
};
