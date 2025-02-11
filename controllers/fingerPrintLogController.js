const FingerPrintLog = require("../models/FingerPrintLog");
const Device = require("../models/Device");
const Employee = require("../models/Employee");
const moment = require("moment-timezone");

/**
 * إنشاء سجل جديد مع شرط عدم الإضافة في حال وجود سجل مسبق بنفس الوقت والسيريال نمبر
 */
exports.createLog = async (req, res) => {
  try {
    // في السكيمة لدينا الحقل device_sn بدل "serialNumber"
    // أيضاً نحتاج إضافة شرط المالك (owner)

    // جهّز بيانات السجل الجديدة
    const logData = {
      ...req.body,
      owner: req.userId, // تأكّد من وجود Middleware يضع userId في req.userId
    };

    // ابحث عن سجل موجود مسبقًا بنفس time + device_sn + owner
    const existingLog = await FingerPrintLog.findOne({
      time: req.body.time,
      device_sn: req.body.device_sn,
      owner: req.userId,
    });

    if (existingLog) {
      return res.status(200).json({
        success: true,
        message:
          "هناك سجل يحمل نفس الوقت والجهاز لدى نفس المستخدم. الإدخال ناجح ولكن لم تتم الإضافة.",
      });
    }

    // إنشاء سجل جديد
    const log = await FingerPrintLog.create(logData);
    return res.status(201).json({
      success: true,
      message: "تم إنشاء السجل بنجاح",
      data: log,
    });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Error creating log" });
  }
};

//"2023-02-23 22:19:47"
exports.getBioTime = (stringTime, timezone) => {
  const m = moment(stringTime);
  const year = m.year();
  const month = m.month();
  const date = m.date();
  const hour = m.hour();
  const minutes = m.minutes();
  const seconds = m.seconds();

  const timestampsZoned = moment()
    .tz(timezone)
    .year(year)
    .month(month)
    .date(date)
    .hour(hour)
    .minutes(minutes)
    .seconds(seconds)
    .milliseconds(0)
    .valueOf();

  return moment(timestampsZoned).format("YYYY-MM-DD HH:mm:ss");
};

exports.createLogFromSocket = async (req, res) => {
  try {
    const device = await Device.findOne({
      serial: req.body.device_sn,
    }).populate("owner", "timeZone");

    if (!device) throw new Error("Device not found");

    //format time to timezone
    console.log("old time : " + req.body.time);
    req.body.time = this.getBioTime(req.body.time, device.owner.timeZone);
    console.log("formatted time : " + req.body.time);

    // جهّز بيانات السجل الجديدة
    const logData = {
      ...req.body,
      device_name: device.name,
      owner: device.owner,
    };

    // ابحث عن سجل موجود مسبقًا بنفس time + device_sn + owner
    const existingLog = await FingerPrintLog.findOne({
      time: req.body.time,
      device_sn: req.body.device_sn,
      owner: device.owner,
    });

    if (existingLog) {
      return res.status(200).json({
        success: true,
        message:
          "هناك سجل يحمل نفس الوقت والجهاز لدى نفس المستخدم. الإدخال ناجح ولكن لم تتم الإضافة.",
      });
    }

    // إنشاء سجل جديد
    const log = await FingerPrintLog.create(logData);
    return res.status(201).json({
      success: true,
      message: "تم إنشاء السجل بنجاح",
      data: log,
    });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error });
  }
};

exports.createLogFromApp = async (req, res, next) => {
  try {
    const { event } = req.body;
    if (!event) throw new Error("event not found");

    const employee = req.employee;
    if (!employee) throw new Error("employee not found");

    const logData = {
      enrollid: employee.enroll_id,
      name: employee.name,
      time: new Date().toISOString(),
      fetch_date: new Date().toISOString(),
      image: "",
      device_sn: "App",
      device_name: "App",
      event: event,
      owner: employee.owner,
    };

    //save log
    const log = await FingerPrintLog.create(logData);
    return res.status(201).json({
      success: true,
      message: "تم إنشاء السجل بنجاح",
      data: log,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * جلب السجلات مع إمكانية الفلترة والتجزئة (Pagination)
 *
 * الفلترة اختيارية:
 *   - من تاريخ إلى تاريخ (على حقل time) باستخدام from, to
 *   - إنرول آي دي (enrollid)
 *   - إيفينت (event)
 *
 * التجزئة:
 *   - page (رقم الصفحة)
 *   - limit (عدد السجلات في الصفحة)
 *   - إذا كانت page = 0 يتم إرجاع جميع السجلات دون تجزئة
 */
exports.getLogs = async (req, res) => {
  try {
    let { from, to, enrollid, event, page = 1, limit = 10 } = req.query;
    const filter = {};

    // حدّد المالك (المستخدم) في الفلتر
    if (req.userId) filter.owner = req.userId;

    if (req.employee) {
      filter.enrollid = req.employee.enroll_id;
    }

    // فلترة بالتاريخ على حقل time
    if (from && to) {
      filter.time = { $gte: new Date(from), $lte: new Date(to) };
    } else if (from) {
      filter.time = { $gte: new Date(from) };
    } else if (to) {
      filter.time = { $lte: new Date(to) };
    }

    // فلترة بالـ enrollid إذا أرسل
    if (enrollid) {
      filter.enrollid = parseInt(enrollid, 10);
    }

    // فلترة بالـ event إذا أرسل
    if (event) {
      filter.event = parseInt(event, 10);
    }

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    if (page === 0) {
      const allLogs = await FingerPrintLog.find(filter);
      return res.json({
        logs: allLogs,
        totalCount: allLogs.length,
        page: 0,
        limit: allLogs.length,
      });
    }

    const skip = (page - 1) * limit;
    const totalCount = await FingerPrintLog.countDocuments(filter);
    const logs = await FingerPrintLog.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ time: -1 });

    return res.json({
      logs,
      totalCount,
      currentPage: page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error fetching logs" });
  }
};

/**
 * جلب سجل واحد بالمعرّف (id)
 */
exports.getLogById = async (req, res) => {
  try {
    const { id } = req.params;
    // بدلاً من findById(id) -> نستخدم findOne مع owner
    const log = await FingerPrintLog.findOne({ _id: id, owner: req.userId });
    if (!log) {
      return res
        .status(404)
        .json({ message: "Log not found or not owned by you" });
    }
    return res.json(log);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Error fetching log" });
  }
};

/**
 * تحديث سجل محدد
 */
exports.updateLog = async (req, res) => {
  try {
    const { id } = req.params;
    // ابحث وحدث بسجل يخص المالك الحالي
    const updatedLog = await FingerPrintLog.findOneAndUpdate(
      { _id: id, owner: req.userId },
      req.body,
      { new: true }
    );
    if (!updatedLog) {
      return res
        .status(404)
        .json({ message: "Log not found or not owned by you" });
    }
    return res.json(updatedLog);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Error updating log" });
  }
};

/**
 * حذف سجل محدد
 */
exports.deleteLog = async (req, res) => {
  try {
    const { id } = req.params;
    // حذف بسجل يخص نفس المالك
    const deletedLog = await FingerPrintLog.findOneAndDelete({
      _id: id,
      owner: req.userId,
    });
    if (!deletedLog) {
      return res
        .status(404)
        .json({ message: "Log not found or not owned by you" });
    }
    return res.json({ message: "Log deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Error deleting log" });
  }
};
