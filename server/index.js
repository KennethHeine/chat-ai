const express = require("express");
const session = require("express-session");
const path = require("path");
const authRouter = require("./auth");
const chatRouter = require("./chat");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
const isProduction = process.env.NODE_ENV === "production";
if (isProduction && !process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET must be set in production");
  process.exit(1);
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: isProduction, httpOnly: true, sameSite: "lax", maxAge: 24 * 60 * 60 * 1000 },
  })
);

app.use(express.static(path.join(__dirname, "..", "public")));

// CSRF protection: verify Origin header on state-changing requests
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  const origin = req.get("origin");
  if (origin) {
    const host = req.get("host");
    const allowed = `${req.protocol}://${host}`;
    if (origin !== allowed) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  next();
});

app.use("/auth", authRouter);
app.use("/api", chatRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
