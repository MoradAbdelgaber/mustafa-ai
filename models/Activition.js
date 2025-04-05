const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ActivitionSchema = new Schema({
  // باركود الترخيص
  name: {
    type: String,
    required: true,
    trim: true
  },
  // مالك الفرع (يمكن ربطه بالمستخدم عبر المرجع)
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Activition", ActivitionSchema);
