// src/index.js
import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "../db.js";            // db.js está en la raíz

import authLocalRouter from "./routes/authLocal.js";
import encuestasRouter from "./routes/encuestas.js";
import respuestasRouter from "./routes/respuestas.js";

const app = express();

/* --------- CORS --------- */
const ORIGIN = process.env.CLIENT_URL || "http://localhost:5173";
app.use(cors({
  origin: ORIGIN,
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));
app.options("*", cors());

/* --------- Cookies / sesión --------- */
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

/* --------- Health (NO toca DB) --------- */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* --------- Conexión a DB on-demand (SIN top-level await) --------- */
let __dbReady = false;
async function ensureDB() {
  if (!__dbReady) {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing");
    await connectDB(process.env.MONGODB_URI);
    __dbReady = true;
  }
}
app.use(async (_req, res, next) => {
  try { await ensureDB(); next(); }
  catch (e) {
    console.error("DB init error:", e?.message || e);
    res.status(500).json({ error: "DB connection failed" });
  }
});

/* --------- Rutas (sin prefijo /api aquí) --------- */
app.use("/auth",       authLocalRouter);
app.use("/encuestas",  encuestasRouter);
app.use("/respuestas", respuestasRouter);

export default app;     // <- SIN app.listen en Vercel
