import { Router } from "express";
import Usuario from "../models/Usuario.js";

const router = Router();

/**
 * Crea o devuelve un usuario por email (idempotente).
 * Body: { email: "..." }
 */
router.post("/", async (req, res) => {
  try {
    let { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "email es requerido" });

    email = String(email).trim().toLowerCase();

    // Intenta encontrar primero
    let user = await Usuario.findOne({ email }).lean();
    if (user) return res.json(user);

    // Crea nuevo (dispara el pre-save para numericId)
    const nuevo = new Usuario({ email });
    await nuevo.save();

    // Devuelve plano
    const plain = nuevo.toObject();
    return res.status(201).json(plain);
  } catch (err) {
    // Si dos peticiones compiten, puede saltar E11000 de índice único
    if (err.code === 11000) {
      const again = await Usuario.findOne({ email: req.body.email.toLowerCase() }).lean();
      if (again) return res.json(again);
    }
    console.error(err);
    return res.status(500).json({ error: "Error creando usuario" });
  }
});

/**
 * GET /api/usuarios?email=...
 * Busca por email (opcional). Si no hay query, devuelve últimos 50.
 */
router.get("/", async (req, res) => {
  try {
    const { email } = req.query;
    if (email) {
      const user = await Usuario.findOne({ email: String(email).toLowerCase() }).lean();
      return user ? res.json(user) : res.status(404).json({ error: "No encontrado" });
    }
    const list = await Usuario.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error listando usuarios" });
  }
});

/**
 * GET /api/usuarios/:numericId
 * Obtiene por numericId (el autoincremental).
 */
router.get("/:numericId", async (req, res) => {
  try {
    const numericId = Number(req.params.numericId);
    if (!Number.isFinite(numericId)) return res.status(400).json({ error: "numericId inválido" });

    const user = await Usuario.findOne({ numericId }).lean();
    return user ? res.json(user) : res.status(404).json({ error: "No encontrado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo usuario" });
  }
});

export default router;
