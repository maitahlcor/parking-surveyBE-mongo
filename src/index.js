import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./db.js";

import authLocalRouter from "./routes/authLocal.js";
import encuestasRouter from "./routes/encuestas.js";
import respuestasRouter from "./routes/respuestas.js";
import authQuickRouter from "./routes/authQuick.js";

const app = express();

const ORIGIN = process.env.CLIENT_URL || "http://localhost:5173";
const corsOpts = {
  origin: ORIGIN,           // o (origin, cb) => cb(null, true) si quieres permitir todo en dev
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
};

app.use(cors(corsOpts));
// Si quieres mantener preflight explícito, usa RegExp o prefijos (no "*"):
// app.options(/.*/, cors(corsOpts));

app.use(cookieParser());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authQuickRouter);
app.use("/auth", authLocalRouter);
app.use("/api/encuestas", encuestasRouter);
app.use("/api/respuestas", respuestasRouter);

const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGODB_URI).then(() => {
  app.listen(PORT, () => console.log(`🚀 API http://localhost:${PORT}`));
});
