const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const { handleClerkWebhook } = require("../controllers/webhook.controller");

router.post("/clerk", asyncHandler(handleClerkWebhook));

module.exports = router;
