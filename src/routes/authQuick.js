// src/routes/authQuick.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import Usuario from "../models/Usuario.js";
import { signJwt } from "../utils/jwt.js";

const router = Router();

/** LOGIN */
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email y password requeridos" });

    email = String(email).trim().toLowerCase();
    const user = await Usuario.findOne({ email });
    if (!user) return res.status(401).json({ error: "credenciales inválidas" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "credenciales inválidas" });

    const token = signJwt({ id: user._id.toString(), email: user.email, numericId: user.numericId });
    res.json({
      token,
      user: { id: user._id, email: user.email, numericId: user.numericId }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No se pudo iniciar sesión" });
  }
});

/** Perfil rápido (opcional) */
router.get("/me", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No autenticado" });

    // misma lógica de verifyJwt que tu middleware
    const { verifyJwt } = await import("../utils/jwt.js");
    const payload = verifyJwt(token);
    res.json(payload);
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
});

export default router;
