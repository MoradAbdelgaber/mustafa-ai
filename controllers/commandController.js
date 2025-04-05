// controllers/command.controller.js

const Command = require("../models/Command");

/**
 * إضافة أمر جديد مع تخزين sn في device_sn وتخزين الـ body كاملًا في حقل body
 */
exports.createCommand = async (req, res) => {
    try {
      // تجهيز بيانات الأمر الجديد
      const commandData = {
        device_sn: req.body.device_sn,       // من الـ body
        body: req.body.body,                // تخزين كامل الـ body
        executionDate: req.body.executionDate || new Date(),
        executionResult: req.body.executionResult || "Wait",
        response: req.body.response || "",
        operationType: req.body.operationType || "",
        // لو عندك Owner أو UserId
        owner: req.body.owner || null,
        // تخزين السيرفر إن احتجت
        server: req.body.server || {},
        // repeatable إن أردت الافتراضي ابقه كما هو
        // repeatable: req.body.repeatable ?? true
      };
  
      const newCommand = new Command(commandData);
      const savedCommand = await newCommand.save();
  
      // نعيده للواجهة إن احتاجت
      return res.status(201).json(savedCommand);
    } catch (err) {
      console.error("Error while creating a command:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  //تعديل
  exports.updateCommand = async (req, res) => {
    try {
      const commandId = req.params.id;
      const { executionResult, response } = req.body;
  
      // ابحث عن السجل وعدّل الحقول المطلوبة
      const updatedCommand = await Command.findByIdAndUpdate(
        commandId,
        {
          $set: {
            executionResult: executionResult,
            response: response
          }
        },
        { new: true }  // لكي يعيد العنصر بعد التحديث
      );
  
      if (!updatedCommand) {
        return res.status(404).json({ message: "Command not found" });
      }
  
      return res.json(updatedCommand);
    } catch (err) {
      console.error("Error while updating command:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
  

/**
 * جلب الأوامر مع التجزئة والتصفية
 * يمكن التصفية على:
 * - تاريخ الإضافة: startDate, endDate (يعتمد على createdAt)
 * - سيريال الجهاز: device_sn
 * - الحالة: executionResult
 * كما يمكن تمرير معلمات page وlimit للتجزئة
 */
exports.getCommands = async (req, res) => {
  try {
    // استخراج معلمات الاستعلام (query) للتجزئة والتصفية
    let { page, limit, startDate, endDate, device_sn, executionResult } =
      req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;

    // بناء كائن التصفية (filter)
    const filter = {};

    // تصفية على تاريخ الإضافة (createdAt)
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // تصفية على سيريال الجهاز
    if (device_sn) {
      filter.device_sn = device_sn;
    }

    // تصفية على الحالة (executionResult)
    if (executionResult) {
      filter.executionResult = executionResult;
    }

    // جلب البيانات مع التجزئة والترتيب (أحدث أولاً)
    const commands = await Command.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // حساب العدد الكلي للنتائج المطابقة للتصفية
    const total = await Command.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: commands,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * تعديل أمر بناءً على المعرف (ID)
 */
exports.updateCommand = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCommand = await Command.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updatedCommand) {
      return res.status(404).json({
        success: false,
        message: "الأمر غير موجود",
      });
    }
    return res.status(200).json({
      success: true,
      data: updatedCommand,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * حذف أمر بناءً على المعرف (ID)
 */
exports.deleteCommand = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCommand = await Command.findByIdAndDelete(id);
    if (!deletedCommand) {
      return res.status(404).json({
        success: false,
        message: "الأمر غير موجود",
      });
    }
    return res.status(200).json({
      success: true,
      message: "تم حذف الأمر بنجاح",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
