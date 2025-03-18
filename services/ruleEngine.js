/**
 * services/ruleEngine.js
 * 
 * في هذا الملف نقوم بكتابة منطق متقدم لتطبيق الشروط والإجراءات. 
 * يدعم شروط مركبة (AND / OR) مع إمكانية التعشيق (Nested).
 */

function evaluateCondition(record, condition) {
  // مثال مبسّط لدعم operators: eq, ne, gt, lt, gte, lte, gtTime, ltTime
  const { field, operator, value, valueType } = condition;
  
  // إذا كانت قيمة الشرط من نوع متغير (variable)، نأخذها من record[value]
  // وإلا فهي قيمة ثابتة (constant أو غير محددة)
  let compareVal;
  if (valueType === "variable") {
    compareVal = record[value];
  } else {
    compareVal = value;
  }

  // قيمة الحقل في السجل
  const recordValue = record[field];

  // تحويلهما إلى أرقام عند الحاجة:
  let numericRecordVal = parseFloat(recordValue) || 0;
  let numericVal = parseFloat(compareVal) || 0;

  let result = false;
  switch (operator) {
    case "eq":
      // المقارنة قد تكون نصية أو رقمية، تبعًا لتصميمك
      result = recordValue == compareVal;
      break;
    case "ne":
      result = recordValue != compareVal;
      break;
    case "gt":
      result = numericRecordVal > numericVal;
      break;
    case "lt":
      result = numericRecordVal < numericVal;
      break;
    case "gte":
      result = numericRecordVal >= numericVal;
      break;
    case "lte":
      result = numericRecordVal <= numericVal;
      break;
    case "gtTime":
      if (!recordValue) result = false;
      else result = recordValue.localeCompare(compareVal) > 0;
      break;
    case "ltTime":
      if (!recordValue) result = false;
      else result = recordValue.localeCompare(compareVal) < 0;
      break;
    default:
      result = false;
  }
  // رسائل تصحيح للتتبع
  console.log(`evaluateCondition: field=${field}, operator=${operator}, valueType=${valueType}, compareVal=${compareVal}, recordValue=${recordValue} ==> ${result}`);
  return result;
}

/**
 * دالة تتحقق من تحقق كتلة شروط واحدة.
 * تدعم بنية مركبة سواء باستخدام conditions أو subConditions.
 */
function evaluateConditionsBlock(record, conditionsBlock) {
  if (!conditionsBlock) return true; // في حال عدم وجود شروط نعيد true

  const { operator = "AND", conditions = [], subConditions = [] } = conditionsBlock;

  // تقييم الشروط الفرعية (nested)
  let subResults = subConditions.map((sub) =>
    evaluateConditionsBlock(record, sub)
  );

  // تقييم الشروط العادية
  let results = conditions.map((cond) => evaluateCondition(record, cond));

  // دمج النتائج
  let allResults = [...subResults, ...results];

  let blockResult;
  if (operator === "AND") {
    blockResult = allResults.every((r) => r === true);
  } else if (operator === "OR") {
    blockResult = allResults.some((r) => r === true);
  } else {
    blockResult = false;
  }
  console.log(`evaluateConditionsBlock with operator ${operator} => ${blockResult} (results: ${allResults})`);
  return blockResult;
}

/**
 * دالة جديدة لتقييم مجموعات الشروط (conditionsGroups) باستخدام عامل OR.
 * ترجع true إذا تحقق أي مجموعة شرطية.
 */
function evaluateConditionsGroups(record, groups) {
  if (!groups || !groups.length) return true;
  const groupsResults = groups.map(group => evaluateConditionsBlock(record, group));
  const finalResult = groupsResults.some(result => result === true);
  console.log(`evaluateConditionsGroups results: ${groupsResults}, finalResult: ${finalResult}`);
  return finalResult;
}

/**
 * تنفيذ الإجراءات (actions) في حال تطابق الشروط.
 */
function applyActions(record, actions) {
  for (let action of actions) {
    const { field, type, value, valueType } = action;
    if (!field || !type) continue;

    // إذا كانت قيمة الإجراء من نوع متغير (variable)، نأخذها من record[value]
    // وإلا فهي قيمة ثابتة.
    let actionVal;
    if (valueType === "variable") {
      actionVal = record[value];
    } else {
      actionVal = value;
    }

    switch (type) {
      case "set":
        // تعيين قيمة الحقل مباشرة
        record[field] = parseFloat(actionVal) || actionVal;
        break;
      case "increment": {
        let currentVal = parseFloat(record[field]) || 0;
        let incVal = parseFloat(actionVal) || 0;
        record[field] = currentVal + incVal;
      }
        break;
      case "multiply": {
        let currentVal = parseFloat(record[field]) || 0;
        let mulVal = parseFloat(actionVal) || 1;
        record[field] = currentVal * mulVal;
      }
        break;
      case "time_adjust": {
        let original = record[field];
        if (original) {
          let dateObj = new Date(original);
          if (!isNaN(dateObj.getTime())) {
            let minutesToAdd = parseInt(actionVal, 10) || 0;
            dateObj.setMinutes(dateObj.getMinutes() + minutesToAdd);
            record[field] = dateObj.toISOString();
          }
        }
      }
        break;
      default:
        break;
    }
    console.log(`applyActions: Applied action ${type} on field ${field} with valueType=${valueType}, actionVal=${actionVal}. New value: ${record[field]}`);
  }
  return record;
}

/**
 * دالة رئيسية لتطبيق القواعد على سجل واحد.
 * تدعم إما استخدام conditionsGroups أو conditionsBlock.
 * **تعديل مهم:** إذا كان لدينا conditionsBlock يحتوي على subConditions ونستخدم العامل "AND"
 * في المستوى الأعلى، نقوم بتغييره إلى "OR" لتطبيق منطق OR بين المجموعات.
 */
function applyRulesToRecord(record, rulesList) {
  if (!rulesList || !rulesList.length) return record;

  // نفرز القواعد حسب الأولوية (من الأصغر للأكبر)
  rulesList = rulesList.sort((a, b) => (a.priority || 0) - (b.priority || 0));

  for (let rule of rulesList) {
    console.log(`Evaluating rule: ${rule.name}`);
    // تحقق من صلاحية تاريخ السجل بالنسبة للقاعدة
    if (rule.validFrom && new Date(record.attendance_date) < new Date(rule.validFrom)) {
      console.log(`Rule ${rule.name} skipped due to validFrom`);
      continue;
    }
    if (rule.validTo && new Date(record.attendance_date) > new Date(rule.validTo)) {
      console.log(`Rule ${rule.name} skipped due to validTo`);
      continue;
    }

    let ruleMatch = false;
    if (rule.conditionsGroups) {
      // إذا كانت القاعدة تستخدم conditionsGroups فإننا نستخدمها مع OR
      ruleMatch = evaluateConditionsGroups(record, rule.conditionsGroups);
    } else if (rule.conditionsBlock) {
      // **تعديل:** إذا كان لدينا conditionsBlock ونريد دمج subConditions بنظام OR،
      // فقم بتعديل العامل في المستوى الأعلى إلى OR
      if (rule.conditionsBlock.subConditions && rule.conditionsBlock.operator === "AND") {
        console.log(`Overriding top-level operator from AND to OR for rule ${rule.name}`);
        rule.conditionsBlock.operator = "OR";
      }
      ruleMatch = evaluateConditionsBlock(record, rule.conditionsBlock);
    } else {
      // في حال عدم وجود شروط، نفترض تطابق القاعدة
      ruleMatch = true;
    }

    console.log(`Rule ${rule.name} match result: ${ruleMatch}`);

    if (ruleMatch) {
      // تنفيذ الإجراءات في حال تطابق القاعدة
      record = applyActions(record, rule.actions || []);
      // إذا كان stopOnMatch=true نتوقف عن تقييم بقية القواعد
      if (rule.stopOnMatch) {
        console.log(`Rule ${rule.name} has stopOnMatch true, stopping further evaluation.`);
        break;
      }
    }
  }
  return record;
}

module.exports = {
  applyRulesToRecord,
};
