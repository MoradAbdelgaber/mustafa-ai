// config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const dbPath =
      process.env.TYPE == "DEV"
        ? process.env.MONGO_URI_LOCAL
        : process.env.MONGO_URI;

    await mongoose.connect(dbPath, {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });
    console.log("MongoDB connected successfully. : " + dbPath);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
