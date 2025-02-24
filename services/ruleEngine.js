// services/ruleEngine.js

/**
 * تطبق القواعد على سجل الحضور.
 * تُطبَّق القاعدة فقط إذا كان تاريخ السجل يقع ضمن الفترة الزمنية المحددة (validFrom - validTo) إن وُجدت.
 *
 * كما تمت إضافة عملية تعديل الوقت على الحقول التي تحتوي على تاريخ/وقت.
 *
 * @param {Object} record - سجل الحضور الذي سيتم تطبيق القواعد عليه.
 * @param {Array} rules - مصفوفة القواعد.
 * @returns {Object} - السجل بعد تعديل القيم بناءً على القواعد.
 */
function applyRulesToRecord(record, rules) {
  // إنشاء نسخة معدلة من السجل الأصلي
  let modifiedRecord = { ...record };

  // تحويل تاريخ الحضور إلى كائن Date (نفترض أن record.attendance_date بصيغة YYYY-MM-DD)
  const recordDate = record.attendance_date ? new Date(record.attendance_date) : null;

  // المرور على جميع القواعد
  for (const rule of rules) {
    // فحص الفترة الزمنية للقاعدة (إن كانت محددة)
    if (recordDate && (rule.validFrom || rule.validTo)) {
      if (rule.validFrom && recordDate < new Date(rule.validFrom)) {
        // تاريخ السجل قبل بداية صلاحية القاعدة
        continue;
      }
      if (rule.validTo && recordDate > new Date(rule.validTo)) {
        // تاريخ السجل بعد انتهاء صلاحية القاعدة
        continue;
      }
    }

    // تقييم شروط القاعدة (نفترض أن جميع الشروط يجب أن تتحقق)
    let conditionsMet = true;
    if (Array.isArray(rule.conditions)) {
      conditionsMet = rule.conditions.every(condition => {
        // مثال على شكل الشرط:
        // { field: 'status_code', operator: 'eq', value: 'late' }
        const recordValue = modifiedRecord[condition.field];
        switch (condition.operator) {
          case 'eq':
          case '==':
            return recordValue == condition.value;
          case 'ne':
          case '!=':
            return recordValue != condition.value;
          case 'gt':
          case '>':
            return recordValue > condition.value;
          case 'lt':
          case '<':
            return recordValue < condition.value;
          case 'gte':
          case '>=':
            return recordValue >= condition.value;
          case 'lte':
          case '<=':
            return recordValue <= condition.value;
          default:
            return false;
        }
      });
    }

    if (conditionsMet) {
      // تطبيق الأفعال (actions) في حال تحقق الشروط
      if (Array.isArray(rule.actions)) {
        rule.actions.forEach(action => {
          const field = action.field;
          const currentValue = modifiedRecord[field];
          // يتم استخدام الخاصية "type" من القاعدة لتحديد نوع العملية
          switch (action.type) {
            case 'add':
              modifiedRecord[field] = (Number(currentValue) || 0) + Number(action.value);
              break;
            case 'subtract':
              modifiedRecord[field] = (Number(currentValue) || 0) - Number(action.value);
              break;
            case 'set':
              modifiedRecord[field] = action.value;
              break;
            case 'multiply':
              modifiedRecord[field] = (Number(currentValue) || 0) * Number(action.value);
              break;
            case 'time_adjust':
              // تعديل الوقت في حقل يحتوي على تاريخ/وقت.
              // نفترض أن القيمة الحالية إما كائن Date أو نص قابل للتحويل إلى Date.
              let dateObj = new Date(currentValue);
              if (!isNaN(dateObj.getTime())) {
                // القيمة action.value تمثل عدد الدقائق التي سيتم إضافتها (يمكن أن تكون سالبة للطرح)
                dateObj.setMinutes(dateObj.getMinutes() + Number(action.value));
                // يمكن تخزين النتيجة كنص بصيغة ISO أو ككائن Date حسب الحاجة
                modifiedRecord[field] = dateObj.toISOString();
              }
              break;
            default:
              break;
          }
        });
      }

      // إذا كانت الخاصية stopOnMatch صحيحة، نتوقف عن تطبيق باقي القواعد
      if (rule.stopOnMatch) {
        break;
      }
    }
  }

  return modifiedRecord;
}

module.exports = { applyRulesToRecord };
