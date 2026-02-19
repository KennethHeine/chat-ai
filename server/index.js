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
    cookie: { secure: isProduction, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  })
);

app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/auth", authRouter);
app.use("/api", chatRouter);

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
