import { Router } from "express";
import bcrypt from "bcryptjs";
import Usuario from "../models/Usuario.js";

const router = Router();

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email y contraseña son obligatorios" });
    }

    const exists = await Usuario.findOne({ email });
    if (exists) {
      return res.status(409).json({ ok: false, error: "El correo ya existe" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await Usuario.create({ email, passwordHash });

    // si usas sesión:
    req.session.userId = user._id.toString();

    return res.status(201).json({ ok: true, id: user._id, email: user.email });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "No se pudo crear el usuario" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email y contraseña son obligatorios" });
    }

    const user = await Usuario.findOne({ email });
    if (!user) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });

    req.session.userId = user._id.toString();
    return res.json({ ok: true, id: user._id, email: user.email });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error al iniciar sesión" });
  }
});

// GET /auth/me
router.get("/me", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ ok: false });
    }
    const user = await Usuario.findById(req.session.userId).select("email numericId");
    if (!user) return res.status(401).json({ ok: false });
    return res.json({ ok: true, id: user._id, email: user.email, numericId: user.numericId });
  } catch {
    return res.status(500).json({ ok: false, error: "Error" });
  }
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  req.session?.destroy?.(() => {});
  res.clearCookie("connect.sid"); // nombre por defecto de express-session
  res.status(204).end();
});

export default router;
