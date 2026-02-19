const express = require("express");
const session = require("express-session");
const path = require("path");
const authRouter = require("./auth");
const chatRouter = require("./chat");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
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
