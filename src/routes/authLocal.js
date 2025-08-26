import { Router } from "express";
import bcrypt from "bcryptjs";
import Usuario from "../models/Usuario.js";
import { signJwt } from "../utils/jwt.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: false,           // en producción detrás de HTTPS → true
    sameSite: "lax",         // si el front está en otro dominio y usas HTTPS, usa "none" y secure:true
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 días
  });
}

/** Registro */
router.post("/register", async (req, res) => {
  try {
    let { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email y password son requeridos" });

    email = String(email).trim().toLowerCase();
    if (password.length < 6) return res.status(400).json({ error: "password mínimo 6 caracteres" });

    const existing = await Usuario.findOne({ email });
    if (existing) return res.status(409).json({ error: "email ya registrado" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await new Usuario({ email, passwordHash, name: name || "" }).save();

    const token = signJwt({ id: user._id.toString(), email: user.email, numericId: user.numericId, name: user.name });
    setAuthCookie(res, token);

    res.status(201).json({
      id: user._id,
      email: user.email,
      numericId: user.numericId,
      name: user.name
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No se pudo registrar" });
  }
});

/** Login */
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email y password son requeridos" });

    email = String(email).trim().toLowerCase();
    const user = await Usuario.findOne({ email });
    if (!user) return res.status(401).json({ error: "credenciales inválidas" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "credenciales inválidas" });

    const token = signJwt({ id: user._id.toString(), email: user.email, numericId: user.numericId, name: user.name });
    setAuthCookie(res, token);

    res.json({
      id: user._id,
      email: user.email,
      numericId: user.numericId,
      name: user.name
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No se pudo iniciar sesión" });
  }
});

/** Perfil actual */
router.get("/me", requireAuth, async (req, res) => {
  res.json({ authenticated: true, user: req.user }); // payload del token
});

/** Logout */
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

export default router;
