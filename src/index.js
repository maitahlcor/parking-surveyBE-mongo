// src/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './db.js';
// importa routers pero NO los montes aún
import authLocalRouter from './routes/authLocal.js';
import authQuickRouter from './routes/authQuick.js';
import encuestasRouter from './routes/encuestas.js';
import respuestasRouter from './routes/respuestas.js';

const app = express();
const ORIGIN = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({
  origin: ORIGIN,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors({ origin: ORIGIN, credentials: true }));

app.use(cookieParser());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// 🔴 deja TODO comentado por ahora
// app.use('/auth', authQuickRouter);
// app.use('/auth', authLocalRouter);
// app.use('/api/encuestas', encuestasRouter);
// app.use('/api/respuestas', respuestasRouter);

const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGODB_URI).then(() => {
  app.listen(PORT, () => console.log(`🚀 API http://localhost:${PORT}`));
});
