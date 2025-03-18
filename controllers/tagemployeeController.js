const TagEmployee = require("../models/tagemployee");

// إنشاء تاك جديد
exports.createTagEmployee = async (req, res) => {
  try {
    const { name } = req.body;
    // نفترض أن الميدلوير للمصادقة يضيف بيانات المستخدم في req.user
    const owner = req.user._id;
    
    const newTag = new TagEmployee({ name, owner });
    await newTag.save();

    res.status(201).json({ message: "تم إنشاء التاك بنجاح", tag: newTag });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
};

// استرجاع جميع التاكات الخاصة بالمستخدم
exports.getAllTagEmployees = async (req, res) => {
  try {
    const owner = req.user._id;
    const tags = await TagEmployee.find({ owner });
    res.status(200).json(tags);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
};

// استرجاع تاك بواسطة المعرف (ID)
exports.getTagEmployeeById = async (req, res) => {
  try {
    const tag = await TagEmployee.findById(req.params.id);
    if (!tag) {
      return res.status(404).json({ message: "التاك غير موجود" });
    }
    res.status(200).json(tag);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
};

// تحديث بيانات تاك موجود
exports.updateTagEmployee = async (req, res) => {
  try {
    const tag = await TagEmployee.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!tag) {
      return res.status(404).json({ message: "التاك غير موجود" });
    }
    res.status(200).json({ message: "تم تحديث التاك بنجاح", tag });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
};

// حذف تاك
exports.deleteTagEmployee = async (req, res) => {
  try {
    const tag = await TagEmployee.findByIdAndDelete(req.params.id);
    if (!tag) {
      return res.status(404).json({ message: "التاك غير موجود" });
    }
    res.status(200).json({ message: "تم حذف التاك بنجاح" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
};
