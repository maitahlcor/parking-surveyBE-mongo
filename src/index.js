// src/index.js
import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./db.js";

import authLocalRouter from "./routes/authLocal.js";
import encuestasRouter from "./routes/encuestas.js";
import respuestasRouter from "./routes/respuestas.js";

const app = express();

/* ====== CORS (prod + dev) ====== */
const allowedOrigins = [
  process.env.CLIENT_URL,       // ej: https://parking-sruvey-fe.vercel.app
  process.env.CLIENT_URL_DEV    // ej: http://localhost:5173
].filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/Postman
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.options("*", cors());

/* ====== Cookies / sesión ====== */
const isProd = process.env.NODE_ENV === "production";

app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd, // true en Render (HTTPS)
  },
}));

app.use(express.json());

/* ====== Health ====== */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ====== Rutas ====== */
// OJO: Tu código original ya usa /api para estos recursos
app.use("/auth", authLocalRouter);
app.use("/api/encuestas", encuestasRouter);
app.use("/api/respuestas", respuestasRouter);

/* ====== Arranque ====== */
const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGODB_URI).then(() => {
  app.listen(PORT, () => console.log(`🚀 API http://localhost:${PORT}`));
});
