const Serials = ["ZXRE06022863","ZYRL07096754","AYSI06099903","ZXRE06022934"];

module.exports = {
  isValid: (serial) => {
    //Free
    if (!Serials.length) return true;
    //validate
    return Serials.includes(serial);
  },
  middleware: (req, res, next) => {
    const serial = req.body.sn;
    //Free
    if (!Serials.length) return next();
    //validate
    if (module.exports.isValid(serial)) {
      next();
    } else {
      res.status(400).json({ error: "Invalid serial number" });
    }
  },
};
