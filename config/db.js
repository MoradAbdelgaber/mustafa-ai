// config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const dbPath =
      process.env.type == "DEV" ? process.env.dbLocal : process.env.db;

    await mongoose.connect(dbPath, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected successfully. : " + dbPath);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
