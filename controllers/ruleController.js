// controllers/ruleController.js

const Rule = require('../models/Rule');

/**
 * جلب جميع القواعد لهذا الـ owner
 */
exports.getRules = async (req, res) => {
  try {
    const rules = await Rule.find({ owner: req.userId }).sort({ priority: 1 });
    res.json(rules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get rules', details: err.message });
  }
};

/**
 * إضافة قاعدة جديدة
 * نتوقع أن يحتوي body على: name, priority, stopOnMatch, conditions, actions, validFrom, validTo
 */


exports.createRule = async (req, res) => {
  try {
    // استخراج البيانات من جسم الطلب
    const { name, priority, stopOnMatch, conditionsGroups, actions, validFrom, validTo } = req.body;

    // تحقق أساسي من صحة البيانات
    if (!name) {
      return res.status(400).json({ error: 'اسم القاعدة مطلوب' });
    }

    // إعداد البنية المطلوبة لحقل conditionsBlock في المخطط
    // حيث أن المخطط يتوقع كائن يحتوي على operator, conditions, و subConditions.
    // هنا نعتبر أن بيانات conditionsGroups المرسلة تمثل subConditions.
    const conditionsBlock = {
      operator: "AND", // يمكن تغييرها حسب منطق التطبيق
      conditions: [],  // إذا كنت تريد شروط على المستوى الرئيسي يمكنك تعبئتها هنا
      subConditions: Array.isArray(conditionsGroups) ? conditionsGroups : []
    };

    // إنشاء القاعدة الجديدة
    const newRule = new Rule({
      owner: req.userId,  // تأكد من وجود معرف المستخدم في req.userId
      name,
      priority,
      stopOnMatch,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
      conditionsBlock,
      actions
    });

    // حفظ القاعدة
    const savedRule = await newRule.save();
    // تحويل المستند إلى كائن عادي
    const ruleObj = savedRule.toObject();

    // تحويل الناتج ليظهر نفس شكل البيانات المرسلة:
    // استبدال conditionsBlock.subConditions بـ conditionsGroups ثم حذف conditionsBlock
    ruleObj.conditionsGroups = ruleObj.conditionsBlock.subConditions;
    delete ruleObj.conditionsBlock;

    res.status(201).json(ruleObj);
  } catch (err) {
    console.error('Error creating rule:', err);
    res.status(500).json({ error: 'Failed to create rule', details: err.message });
  }
};


/**
 * تعديل قاعدة موجودة
 */
exports.updateRule = async (req, res) => {
  try {
    const { id } = req.params; // rule ID
    const rule = await Rule.findOne({ _id: id, owner: req.userId });
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // تحديث الحقول الأساسية
    rule.name = req.body.name ?? rule.name;
    rule.priority = req.body.priority ?? rule.priority;
    rule.stopOnMatch = req.body.stopOnMatch ?? rule.stopOnMatch;
    rule.actions = req.body.actions ?? rule.actions;
    // إذا كانت قيمة validFrom أو validTo فارغة فإننا نخزنها كـ null
    rule.validFrom = req.body.validFrom ? new Date(req.body.validFrom) : null;
    rule.validTo = req.body.validTo ? new Date(req.body.validTo) : null;

    // التحقق من وجود conditionsGroups وتحديث conditionsBlock بناءً عليها
    if (req.body.conditionsGroups && Array.isArray(req.body.conditionsGroups)) {
      rule.conditionsBlock = {
        operator: "AND", // يمكن تغيير هذا حسب منطق التطبيق
        conditions: [],
        subConditions: req.body.conditionsGroups
      };
    } else if (req.body.conditionsBlock) {
      // في حال تم إرسال conditionsBlock مباشرة بدون conditionsGroups
      rule.conditionsBlock = req.body.conditionsBlock;
    }

    await rule.save();

    // تحويل المستند إلى كائن عادي لتعديل البيانات قبل الإرسال
    const ruleObj = rule.toObject();
    if (ruleObj.conditionsBlock) {
      ruleObj.conditionsGroups = ruleObj.conditionsBlock.subConditions;
      delete ruleObj.conditionsBlock;
    }
    res.json(ruleObj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update rule', details: err.message });
  }
};



exports.getRuleById = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await Rule.findOne({ _id: id, owner: req.userId });
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    // تحويل المستند إلى كائن عادي لتعديل البيانات
    const ruleObj = rule.toObject();
    // إذا كان هناك حقل conditionsBlock نقوم بتحويله ليصبح conditionsGroups بنفس الهيكل المرسل
    if (ruleObj.conditionsBlock) {
      ruleObj.conditionsGroups = ruleObj.conditionsBlock.subConditions;
      delete ruleObj.conditionsBlock;
    }
    res.json(ruleObj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get rule', details: err.message });
  }
};


/**
 * حذف قاعدة
 */
exports.deleteRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await Rule.findOneAndDelete({ _id: id, owner: req.userId });
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json({ message: 'Rule deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete rule', details: err.message });
  }
};
