// models/PDFDesign.js
const mongoose = require('mongoose');

const pdfDesignSchema = new mongoose.Schema({
  desgin_name: { type: String, required: true },
  type: { type: String, required: true },
  header_font_size: { type: String, default: '9' },
  header_back_color: { type: String, default: '0xFF000000' },
  header_text_color: { type: String, default: '0xFFFFFFFF' },
  body_font_size: { type: String, default: '9' },
  body_back_color: { type: String, default: '0xFF000000' },
  body_text_color: { type: String, default: '0xFFFFFFFF' },
  visible_columns: { type: [String] },
  columns_width: { type: Object }, // لأننا في SQLite كان JSON
  header_image: { type: Buffer },
  footer_image: { type: Buffer },
  header_image_alignment: { type: String },
  footer_image_alignment: { type: String },
  header_image_size: { type: String },
  footer_image_size: { type: String },
  row_per_page: { type: Number },
  header_page_name: { type: String },
  header_page_name_color: { type: String },
  header_page_name_back_color: { type: String },
  show_department: { type: String },
  show_employee_name: { type: String },
  header_page_name_font_size: { type: String },
  show_statics: { type: String },
  visible_totals_columns: { type: [String] },
  isStatusAscending: { type: String },
  isNameAscending: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('PDFDesign', pdfDesignSchema);
