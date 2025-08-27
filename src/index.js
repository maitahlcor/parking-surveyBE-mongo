// src/index.js
import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "../db.js";             // db.js está en la raíz

import authLocalRouter from "./routes/authLocal.js";      // 👈 dentro de src
import encuestasRouter from "./routes/encuestas.js";      // 👈 dentro de src
import respuestasRouter from "./routes/respuestas.js";    // 👈 dentro de src

// Conexión a Mongo (una sola vez en cold start)
await connectDB(process.env.MONGODB_URI);

const app = express();

// CORS
const ORIGIN = process.env.CLIENT_URL || "http://localhost:5173";
app.use(cors({
  origin: ORIGIN,
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.options("*", cors());

// Cookies / sesión (MemoryStore funciona para pruebas; para prod: connect-mongo)
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

// Rutas
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authLocalRouter);
// ❗️SIN prefijo /api aquí. Vercel ya antepone /api en producción.
app.use("/encuestas",  encuestasRouter);
app.use("/respuestas", respuestasRouter);

export default app;          // 👈 importante
// (sin app.listen aquí)
