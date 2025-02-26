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
    const { name, priority, stopOnMatch, conditions, actions, validFrom, validTo } = req.body;

    const newRule = new Rule({
      owner: req.userId,
      name,
      priority,
      stopOnMatch,
      conditions,
      actions,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null
    });

    await newRule.save();
    res.json(newRule);
  } catch (err) {
    console.error(err);
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

    // تحديث الحقول من body
    rule.name = req.body.name ?? rule.name;
    rule.priority = req.body.priority ?? rule.priority;
    rule.stopOnMatch = req.body.stopOnMatch ?? rule.stopOnMatch;
    rule.conditions = req.body.conditions ?? rule.conditions;
    rule.actions = req.body.actions ?? rule.actions;
    rule.validFrom = req.body.validFrom ? new Date(req.body.validFrom) : rule.validFrom;
    rule.validTo = req.body.validTo ? new Date(req.body.validTo) : rule.validTo;

    await rule.save();
    res.json(rule);
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
    res.json(rule);
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
