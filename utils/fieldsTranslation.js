/**
 * fieldsTranslation.js
 * 
 * يحوي قاموسًا ثنائي الاتجاه:
 *   - من الاسم العربي إلى الاسم الإنجليزي (للاستخدام البرمجي)
 *   - من الاسم الإنجليزي إلى الاسم العربي (للإظهار في الواجهة أو في التقارير)
 */

// تعريف الحقول الخاصة بالتقرير
// يمكنك إضافة أو حذف ما يناسب مشروعك
const arabicToEnglishMap = {
    "وقت_الدخول": "check_in",
    "وقت_الخروج": "check_out",
    "التأخير_بالدقائق": "delay_minutes",
    "الخروج_المبكر_بالدقائق": "early_exit_minutes",
    "أوفر_تايم_بالدقائق": "overtime_minutes",
    "الحالة": "status_code",
    "تاريخ_اليوم": "attendance_date",
    "اسم_الموظف": "employee_name",
    "القسم": "department_name",
    "ساعات_العمل": "work_hours",
    "الأجر_المكتسب_للعمل": "salary_earned_for_work",
    "خصم_التأخير": "late_arrival_deduction",
    "خصم_الخروج_المبكر": "early_exit_deduction",
    "الراتب_الصافي": "net_salary",
    "الدقائق_الإضافية": "extra_minutes",
    // ... أضف كل الحقول الموجودة في التقرير
  };
  
  const englishToArabicMap = {};
  Object.keys(arabicToEnglishMap).forEach(ar => {
    const en = arabicToEnglishMap[ar];
    englishToArabicMap[en] = ar;
  });
  
  module.exports = {
    arabicToEnglishMap,
    englishToArabicMap,
  };
  