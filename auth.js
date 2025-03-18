// middlewares/auth.js
const jwt = require("jsonwebtoken");
const User = require("./models/User"); // تأكد من المسار الصحيح
const Employee = require("./models/Employee"); // تأكد من المسار الصحيح
const { Roles } = require("./utils/roles"); // تأكد من المسار الصحيح

// ميدل وير للتحقق من توكن (إداري/موظف)
exports.authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "No token" });
    }

    // فك التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // نسحب المعرف والأدوار والفروع من التوكن
    const { userId, roles, branche } = decoded;

    // جلب المستخدم من قاعدة البيانات
    const user = await User.findById(userId).select("-pass");
    if (!user) {
      return res.status(401).json({ error: "wrong credentials" });
    }

    // التمييز بين الموظف (USER) والأدمن (ADMIN أو غيره من الأدوار)
    if (user.roles.includes(Roles.USER)) {
      // المستخدم موظف
      req.employee = user; // وضع بيانات الموظف
      req.userId = user.owner; // مالك الموظف
      req.user = await User.findById(user.owner).select("-pass");
    } else {
      // المستخدم أدمن
      req.employee = null; // أو ضعها undefined, لكن وضع null أوضح
      req.userId = user._id;
      req.user = user;
      req.branche = user.branche;
    }

    // تحقق من تفعيل الحساب
    if (!req.user.active) {
      return res.status(403).json({ error: "Account is not active" });
    }

    // أضف الفروع من التوكن إلى req (في حال احتجت استخدامها)
    req.branche = branche; // قد تكون مصفوفة من الفروع

    next();
  } catch (err) {
    console.error(err);
    return res.status(403).json({ error: "Invalid token" });
  }
};

// ميدل وير خاص بالموظف (لو تستعمل توكن مختلف للموظف مثلاً)
exports.authEmployeeMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // نفترض هنا أن التوكن يحوي employeeId
    req.employeeId = decoded.employeeId;
    req.employee = await Employee.findById(req.employeeId)
      .select("-password")
      .populate("owner", "timeZone"); // مثال على populate

    if (!req.employee) {
      return res.status(401).json({ error: "No employee found" });
    }

    // اجلب معرّف المستخدم (الأدمن) من الموظف
    req.userId = req.employee.owner._id;
    next();
  } catch (err) {
    console.error(err);
    return res.status(403).json({ error: "Invalid token" });
  }
};
