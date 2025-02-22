// middlewares/auth.js
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Employee = require("./models/Employee");

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

    const userId = decoded.userId;
    const user = await User.findById(userId).select("-pass");

    if (!user) {
      return res.status(401).json({ error: "wrong credentials" });
    }

    //employee
    if (user.roles.includes(Roles.USER)) {
      //admin data
      req.userId = user.owner;
      req.user = await User.findById(user.owner).select("-pass");
      //employee data
      req.employee = user;
    } else {
      // Admin
      req.userId = user._id;
      req.user = user;
    }

    //check for activation
    if (!req.user.active) {
      return res.status(403).json({ error: "Account is not active" });
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
};

exports.authEmployeeMiddleware = async (req, res, next) => {
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
    req.employeeId = decoded.employeeId;
    req.employee = await Employee.findById(req.employeeId)
      .select("-password")
      .populate("owner", "timeZone");

    if (!req.employee) {
      return res.status(401).json({ error: "No token" });
    }
    req.userId = req.employee.owner._id;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
};
