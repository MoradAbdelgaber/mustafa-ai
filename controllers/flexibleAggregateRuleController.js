const FlexibleAggregateRule = require("../models/FlexibleAggregateRule");

exports.createRule = async (req, res) => {
  try {
    const { 
      name, applyToAll, applyToEmployeeIds, applyToDepartmentIds,
      startDate, endDate, frequency, conditionScript,
      actionType, actionValue, message
    } = req.body;

    const rule = new FlexibleAggregateRule({
      owner: req.userId, // من الـ JWT أو المصادقة
      name,
      applyToAll,
      applyToEmployeeIds,
      applyToDepartmentIds,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      frequency,
      conditionScript,
      actionType,
      actionValue,
      message
    });

    await rule.save();
    res.status(201).json(rule);
  } catch (err) {
    console.error("Error createRule:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateRule = async (req, res) => {
  try {
    const ruleId = req.params.id;
    const updateData = req.body;
    const rule = await FlexibleAggregateRule.findOneAndUpdate(
      { _id: ruleId, owner: req.userId },
      updateData,
      { new: true }
    );
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found or unauthorized' });
    }
    res.json(rule);
  } catch (err) {
    console.error("Error updateRule:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAllRules = async (req, res) => {
  try {
    const rules = await FlexibleAggregateRule.find({ owner: req.userId });
    res.json(rules);
  } catch (err) {
    console.error("Error getAllRules:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRule = async (req, res) => {
  try {
    const ruleId = req.params.id;
    const rule = await FlexibleAggregateRule.findOneAndDelete({ _id: ruleId, owner: req.userId });
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found or unauthorized' });
    }
    res.json({ message: 'Rule deleted successfully' });
  } catch (err) {
    console.error("Error deleteRule:", err);
    res.status(500).json({ error: err.message });
  }
};
