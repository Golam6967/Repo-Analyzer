const express = require("express");
const router = express.Router();
const { requireClerkAuth } = require("../middleware/clerkAuth");
const { asyncHandler } = require("../middleware/errorHandler");
const { getMe, updateProfile } = require("../controllers/user.controller");
const { upload } = require("../config/cloudinary");

router.get("/me", requireClerkAuth, asyncHandler(getMe));
router.put("/profile", requireClerkAuth, upload.single("image"), asyncHandler(updateProfile));

module.exports = router;
