// controllers/vacationController.js
const Vacation = require("../models/Vacation");

exports.createVacation = async (req, res) => {
  try {
    if (req.employee) {
      req.body.enroll_id = req.employee.enroll_id;
      req.body.employee_name = req.employee.name;
    }
    // نضيف owner: req.userId
    const vacationData = {
      ...req.body,
      owner: req.userId,
    };
    const vac = await Vacation.create(vacationData);
    res.status(201).json(vac);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Error creating vacation" });
  }
};

// جلب جميع الإجازات مع إمكانية فلترة بالتواريخ
exports.getAllVacations = async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;
    let query = { owner: req.userId };
    if (req.employee) query.enroll_id = req.employee.enroll_id;

    // ===== فلترة بالتواريخ =====
    if (start_date && end_date) {
      // نبحث عن الإجازات التي تتقاطع مع الفترة المُحددة
      query.vacation_start_date = { $lte: new Date(end_date) };
      query.vacation_end_date = { $gte: new Date(start_date) };
    }

    // ===== فلترة بالحالة (status) =====
    // في هذا المثال:
    // pending  = لم تبدأ الإجازة بعد (start_date > الآن)
    // ongoing  = بدأت الإجازة ولكن لم تنتهِ بعد (start_date <= الآن <= end_date)
    // completed= انتهت الإجازة (end_date < الآن)
    if (status) {
      const now = new Date();
      switch (status) {
        case "Pending":
          query.vacation_start_date = { $gt: now };
          break;
        case "Rejected":
          query.vacation_start_date = { $lte: now };
          query.vacation_end_date = { $gte: now };
          break;
        case "Approved":
          query.vacation_end_date = { $lt: now };
          break;
        default:
          // في حال كانت قيمة غير معروفة يمكن تجاهلها أو إرجاع خطأ
          return res.status(400).json({ error: "Invalid status value" });
      }
    }

    // جلب النتائج بعد تطبيق الشروط
    const data = await Vacation.find(query).populate(
      "vacation_type_id",
      "vacation_name"
    );

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching vacations" });
  }
};

// جلب إجازة واحدة بالمعرّف
exports.getVacationById = async (req, res) => {
  try {
    const { id } = req.params;

    // ابحث عن إجازة تخص المالك الحالي
    const vac = await Vacation.findOne({ _id: id, owner: req.userId });
    if (!vac) {
      return res
        .status(404)
        .json({ message: "Vacation not found or not owned by you" });
    }
    res.json(vac);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Error fetching vacation" });
  }
};

// تحديث إجازة بالمعرّف
exports.updateVacation = async (req, res) => {
  try {
    const { id } = req.params;
    // تحديث إجازة يملكها المستخدم
    const updated = await Vacation.findOneAndUpdate(
      { _id: id, owner: req.userId },
      req.body,
      { new: true }
    );
    if (!updated) {
      return res
        .status(404)
        .json({ message: "Vacation not found or not owned by you" });
    }
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Error updating vacation" });
  }
};

// حذف إجازة بالمعرّف
exports.deleteVacation = async (req, res) => {
  try {
    const { id } = req.params;
    // حذف إجازة يملكها المالك الحالي
    const deleted = await Vacation.findOneAndDelete({
      _id: id,
      owner: req.userId,
    });
    if (!deleted) {
      return res
        .status(404)
        .json({ message: "Vacation not found or not owned by you" });
    }
    res.json({ message: "Vacation deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Error deleting vacation" });
  }
};
