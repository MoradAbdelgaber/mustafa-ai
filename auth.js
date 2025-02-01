// middlewares/auth.js
const jwt = require("jsonwebtoken");
const User = require("./models/User");

exports.authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // نفترض أن الـ userId مخزن في التوكن
    req.userId = decoded.userId;
    req.user = await User.findById(req.userId);
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
};
