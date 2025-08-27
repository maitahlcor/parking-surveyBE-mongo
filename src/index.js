// src/index.js
import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "../db.js";

import authLocalRouter from "./routes/authLocal.js";
import encuestasRouter from "./routes/encuestas.js";
import respuestasRouter from "./routes/respuestas.js";

const app = express();

// ---------- DB: singleton on-demand (evita fallar en cold start) ----------
let dbReady = false;
async function ensureDB() {
  if (!dbReady) {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not set");
    }
    await connectDB(process.env.MONGODB_URI);
    dbReady = true;
  }
}

// ---------- CORS ----------
const ORIGIN = process.env.CLIENT_URL || "http://localhost:5173";
app.use(cors({
  origin: ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.options("*", cors());

// ---------- Cookies / sesión ----------
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: process.env.VERCEL ? "none" : "lax",
    secure: !!process.env.VERCEL,
  }
}));

app.use(express.json());

// ---------- Middleware para asegurar DB por request ----------
app.use(async (req, res, next) => {
  try {
    await ensureDB();
    next();
  } catch (err) {
    console.error("DB init error:", err);
    res.status(500).json({ error: "DB connection failed" });
  }
});

// ---------- Rutas ----------
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authLocalRouter);        // <- sin /api aquí
app.use("/encuestas", encuestasRouter);   // <- sin /api aquí
app.use("/respuestas", respuestasRouter); // <- sin /api aquí

export default app;  // sin app.listen en Vercel
