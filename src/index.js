// src/app.js
import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "../db.js";

import authLocalRouter from "../routes/authLocal.js";
import encuestasRouter from "../routes/encuestas.js";
import respuestasRouter from "../routes/respuestas.js";

const app = express();

// ===== Conexión a Mongo (una vez) =====
await connectDB(process.env.MONGODB_URI);

// ===== CORS =====
const ORIGIN = process.env.CLIENT_URL || "http://localhost:5173";
app.use(cors({
  origin: ORIGIN,
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.options("*", cors());

// ===== Cookies / sesión =====
app.use(cookieParser());

// ⚠️ Si quieres sesiones persistentes en serverless,
// cambia MemoryStore por connect-mongo. De momento preservo tu config.
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // En Vercel es cross-site: usa secure+none
    sameSite: process.env.VERCEL ? "none" : "lax",
    secure: !!process.env.VERCEL,
  }
}));

app.use(express.json());

// ===== Rutas =====
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authLocalRouter);

// 👇 Quitar el prefijo /api aquí para evitar /api/api/... en Vercel
app.use("/encuestas",   encuestasRouter);
app.use("/respuestas",  respuestasRouter);

export default app;
