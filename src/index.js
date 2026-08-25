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

/* ====== CORS (permisivo y estable para navegador) ====== */
const corsConfig = {
  origin: true, // refleja el Origin que venga (Vercel/localhost)
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsConfig));
app.options("*", cors(corsConfig)); // preflight universal 204

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
// OJO: tu backend ya expone /api para estos recursos
app.use("/auth", authLocalRouter);
app.use("/api/encuestas", encuestasRouter);
app.use("/api/respuestas", respuestasRouter);

/* ====== Arranque ====== */
const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGODB_URI).then(() => {
  app.listen(PORT, () => console.log(`🚀 API http://localhost:${PORT}`));
});
