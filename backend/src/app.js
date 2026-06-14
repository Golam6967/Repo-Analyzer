const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const { clerkMiddleware } = require("@clerk/express");
const githubRoutes = require("./routes/githubRoutes");
const webhookRoutes = require("./routes/webhook.routes");
const userRoutes = require("./routes/user.routes");
const authRoutes = require("./routes/auth.routes");
const aiRoutes = require("./routes/aiRoutes");
const { errorHandler } = require("./middleware/errorHandler");
require("dotenv").config();

const app = express();

const allowedOrigins = ["http://localhost:3000", "http://localhost:5173"];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(morgan("dev"));

// Webhooks need raw body before bodyParser
app.use(
  "/api/webhooks",
  express.raw({ type: "application/json" }),
  (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) req.body = JSON.parse(req.body.toString());
    next();
  },
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Clerk middleware adds auth info to req.auth on every request
app.use(clerkMiddleware());

app.use("/api/auth", authRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/users", userRoutes);

app.get("/api/health", (_req, res) => {
  res.status(200).json({ success: true, message: "Server is healthy" });
});

// Central error handler — must be last
app.use(errorHandler);

module.exports = app;
