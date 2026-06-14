const express = require("express");
const router = express.Router();
const { requireClerkAuth } = require("../middleware/clerkAuth");
const { asyncHandler } = require("../middleware/errorHandler");
const { login, register } = require("../controllers/auth.controller");

router.post("/login", requireClerkAuth, asyncHandler(login));
router.post("/register", requireClerkAuth, asyncHandler(register));

module.exports = router;
