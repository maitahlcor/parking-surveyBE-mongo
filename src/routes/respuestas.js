import { Router } from "express";
import Respuesta from "../models/Respuesta.js";

const router = Router();

/**
 * POST /api/respuestas
 * body: { encuestaId, respuestas: [{ preguntaCodigo, valor }, ...] }
 */
router.post("/", async (req, res) => {
  try {
    const { encuestaId, respuestas } = req.body;
    if (!encuestaId || !Array.isArray(respuestas)) {
      return res.status(400).json({ error: "Payload inválido" });
    }

    const docs = respuestas.map(r => ({
      encuesta: encuestaId,
      preguntaCodigo: r.preguntaCodigo,
      valor: r.valor
    }));

    const inserted = await Respuesta.insertMany(docs);
    res.status(201).json({ inserted: inserted.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No se pudieron guardar respuestas" });
  }
});

/** GET /api/respuestas?encuesta=<id> */
router.get("/", async (req, res) => {
  const { encuesta } = req.query;
  const q = encuesta ? { encuesta } : {};
  const list = await Respuesta.find(q).limit(1000);
  res.json(list);
});

export default router;
