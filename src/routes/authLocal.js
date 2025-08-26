import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Usuario from "../models/Usuario.js";

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "dev-secret";

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Faltan campos" });

    const exists = await Usuario.findOne({ email });
    if (exists) return res.status(409).json({ error: "Email ya registrado" });

    const hash = await bcrypt.hash(password, 10);
    const u = await Usuario.create({ email, passwordHash: hash });

    res.json({ ok: true, id: u._id, email: u.email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error registrando" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Faltan campos" });

    const u = await Usuario.findOne({ email });
    if (!u) return res.status(401).json({ error: "Credenciales" });

    const ok = await bcrypt.compare(password, u.passwordHash || "");
    if (!ok) return res.status(401).json({ error: "Credenciales" });

    const token = jwt.sign({ uid: u._id, email: u.email }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    res.json({ ok: true, user: { id: u._id, email: u.email }});
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error login" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  // opcional: validar JWT de cookie y devolver usuario
  res.json({ ok: true });
});

export default router;
