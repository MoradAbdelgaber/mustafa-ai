const TimeSlot = require("../models/TimeSlot");

// إنشاء TimeSlot جديد
exports.createTimeSlot = async (req, res) => {
  try {
    const owner = req.userId;
    const body = req.body; // يمكن إرسال كافة الحقول المطلوبة في req.body
    const doc = new TimeSlot({ ...body, owner });
    await doc.save();
    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل إنشاء الـ TimeSlot" });
  }
};

// استرجاع كافة TimeSlots للمستخدم الحالي
exports.getAllTimeSlots = async (req, res) => {
  try {
    const owner = req.userId;
    const timeSlots = await TimeSlot.find({ owner }).lean();
    return res.json(timeSlots);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل جلب الـ TimeSlots" });
  }
};

// استرجاع TimeSlot معين بواسطة الـ id
exports.getTimeSlotById = async (req, res) => {
  try {
    const owner = req.userId;
    const tsId = req.params.id;
    const timeSlot = await TimeSlot.findOne({ _id: tsId, owner }).lean();
    if (!timeSlot) {
      return res.status(404).json({ error: "لم يتم العثور على الـ TimeSlot" });
    }
    return res.json({ success: true, data: timeSlot });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل جلب الـ TimeSlot" });
  }
};

// تعديل TimeSlot بناءً على الـ id الخاص به والمستخدم المالِك
exports.updateTimeSlot = async (req, res) => {
  try {
    const tsId = req.params.id;
    const owner = req.userId;
    const body = req.body; // تحديث الحقول حسب الحاجة
    const updated = await TimeSlot.findOneAndUpdate(
      { _id: tsId, owner },
      { $set: body },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: "لم يتم العثور على الـ TimeSlot" });
    }
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل تعديل الـ TimeSlot" });
  }
};

// حذف TimeSlot بناءً على الـ id الخاص به والمستخدم المالِك
exports.deleteTimeSlot = async (req, res) => {
  try {
    const tsId = req.params.id;
    const owner = req.userId;
    await TimeSlot.findOneAndDelete({ _id: tsId, owner });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل حذف الـ TimeSlot" });
  }
};
