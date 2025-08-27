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
const ORIGIN = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({
  origin: ORIGIN,
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(cookieParser());

// sesión (si usas sesiones)
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax" } // ajusta según despliegue
}));

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authLocalRouter);
app.use("/api/encuestas", encuestasRouter);
app.use("/api/respuestas", respuestasRouter);

const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGODB_URI).then(() => {
  app.listen(PORT, () => console.log(`🚀 API http://localhost:${PORT}`));
});
