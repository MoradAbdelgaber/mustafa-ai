const Branch = require("../models/Branch");

// إنشاء فرع جديد
exports.createBranch = async (req, res) => {
  try {
    const { name } = req.body;
    // نفترض أن الميدلوير للمصادقة يضيف بيانات المستخدم في req.user
    const owner = req.user._id;
    
    const newBranch = new Branch({ name, owner });
    await newBranch.save();

    res.status(201).json({ message: "تم إنشاء الفرع بنجاح", branch: newBranch });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
};

// استرجاع جميع الفروع الخاصة بالمستخدم
exports.getAllBranches = async (req, res) => {
  try {
    const owner = req.user._id;
    const branches = await Branch.find({ owner });
    res.status(200).json(branches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
};

// استرجاع فرع بواسطة المعرف (ID)
exports.getBranchById = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ message: "الفرع غير موجود" });
    }
    res.status(200).json(branch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
};

// تحديث بيانات فرع موجود
exports.updateBranch = async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!branch) {
      return res.status(404).json({ message: "الفرع غير موجود" });
    }
    res.status(200).json({ message: "تم تحديث الفرع بنجاح", branch });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
};

// حذف فرع
exports.deleteBranch = async (req, res) => {
  try {
    const branch = await Branch.findByIdAndDelete(req.params.id);
    if (!branch) {
      return res.status(404).json({ message: "الفرع غير موجود" });
    }
    res.status(200).json({ message: "تم حذف الفرع بنجاح" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
};
