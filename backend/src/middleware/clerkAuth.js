const { clerkMiddleware, getAuth } = require("@clerk/express");

const clerkAuth = clerkMiddleware();

// Drop-in replacement for deprecated requireAuth()
const requireClerkAuth = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
};

module.exports = { clerkAuth, requireClerkAuth };
