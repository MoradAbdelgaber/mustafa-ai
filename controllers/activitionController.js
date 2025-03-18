const mongoose = require("mongoose");
const Activition = require("../models/Activition"); // تأكد من تعديل المسار حسب تنظيم ملفات مشروعك

// تعريف قيمة owner افتراضية كـ ObjectId ثابت
const DEFAULT_OWNER_ID = mongoose.Types.ObjectId("000000000000000000000001");

// دالة تهيئة السجل الافتراضي عند بدء تشغيل المشروع
const initializeActivition = async () => {
  try {
    const existingActivition = await Activition.findOne({});
    if (!existingActivition) {
      const newActivition = new Activition({
        name: "123456", // القيمة الافتراضية المطلوبة
        owner: DEFAULT_OWNER_ID // قيمة ثابتة للمالك
      });
      await newActivition.save();
      console.log("تم إنشاء سجل Activition الافتراضي");
    } else {
      console.log("سجل Activition موجود مسبقاً");
    }
  } catch (error) {
    console.error("خطأ أثناء تهيئة سجل Activition:", error);
  }
};

// دالة لتعديل السجل الحالي (يُسمح بتعديل قيمة name فقط)
const updateActivition = async (req, res) => {
  try {
    const { name } = req.body;
    let activition = await Activition.findOne({});
    if (!activition) {
      return res.status(404).json({ message: "سجل Activition غير موجود" });
    }
    // تعديل الحقل name إذا تم إرساله في الطلب
    if (name) {
      activition.name = name;
    }
    await activition.save();
    return res.status(200).json({ message: "تم تحديث سجل Activition", activition });
  } catch (error) {
    console.error("خطأ أثناء تحديث سجل Activition:", error);
    return res.status(500).json({ message: "خطأ في الخادم" });
  }
};

// دالة لجلب السجل الحالي
const getActivition = async (req, res) => {
  try {
    const activition = await Activition.findOne({});
    if (!activition) {
      return res.status(404).json({ message: "سجل Activition غير موجود" });
    }
    return res.status(200).json({ activition });
  } catch (error) {
    console.error("خطأ أثناء جلب سجل Activition:", error);
    return res.status(500).json({ message: "خطأ في الخادم" });
  }
};

module.exports = {
  initializeActivition,
  updateActivition,
  getActivition
};
