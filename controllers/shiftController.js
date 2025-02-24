const Shift = require("../models/Shift");

exports.createShift = async (req, res) => {
  try {
    const owner = req.userId;
    const body = req.body;
    // المتوقع: { shiftName, cycleUnit, cycleLength, daysMap: [ { dayIndex, timeSlot }, ... ] }
    const doc = new Shift({ ...body, owner });
    await doc.save();
    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create Shift" });
  }
};

exports.getAllShifts = async (req, res) => {
  try {
    const owner = req.userId;
    const shifts = await Shift.find({ owner })
      .populate("daysMap.timeSlot") // لجلب تفاصيل الـ timeSlot
      .lean();
    return res.json(shifts);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch Shifts" });
  }
};

exports.getShiftById = async (req, res) => {
  try {
    const shiftId = req.params.id;
    const owner = req.userId;
    const shift = await Shift.findOne({ _id: shiftId, owner })
      .populate("daysMap.timeSlot") // لجلب تفاصيل الـ timeSlot
      .lean();
    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }
    return res.json({ success: true, data: shift });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch Shift" });
  }
};

exports.updateShift = async (req, res) => {
  try {
    const shiftId = req.params.id;
    const owner = req.userId;
    const body = req.body;
    const updated = await Shift.findOneAndUpdate(
      { _id: shiftId, owner },
      { $set: body },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: "Shift not found" });
    }
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update Shift" });
  }
};

exports.deleteShift = async (req, res) => {
  try {
    const shiftId = req.params.id;
    const owner = req.userId;
    await Shift.findOneAndDelete({ _id: shiftId, owner });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete Shift" });
  }
};
