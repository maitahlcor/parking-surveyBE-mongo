import { Router } from "express";
import Usuario from "../models/Usuario.js";
import Encuesta from "../models/Encuesta.js";

const router = Router();

/**
 * POST /api/encuestas
 * body: { esPrueba, tipo, coordenadas:{lat,lng}, encuestadorId, usuarioEmail? }
 * crea usuario (si viene email) y arranca la encuesta
 */
router.post("/", async (req, res) => {
  try {
    const { esPrueba, tipo, coordenadas, encuestadorId, usuarioEmail } = req.body;

    let usuario = null;
    if (usuarioEmail) {
      usuario = await Usuario.findOne({ email: usuarioEmail });
      if (!usuario) usuario = await new Usuario({ email: usuarioEmail }).save();
    }

    const encuesta = await Encuesta.create({
      esPrueba: !!esPrueba,
      tipo: String(tipo).toUpperCase() === "LOCAL" ? "LOCAL" : "USUARIO",
      coordenadas,
      encuestadorId: Number(encuestadorId),
      usuario: usuario?._id || null,
      inicio: new Date()
    });

    res.status(201).json(encuesta);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No se pudo crear la encuesta" });
  }
});

/** PATCH /api/encuestas/:id/finalizar */
router.patch("/:id/finalizar", async (req, res) => {
  try {
    const encuesta = await Encuesta.findByIdAndUpdate(
      req.params.id,
      { $set: { fin: new Date() } },
      { new: true }
    );
    res.json(encuesta);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No se pudo finalizar la encuesta" });
  }
});

/** GET /api/encuestas */
router.get("/", async (_req, res) => {
  const list = await Encuesta.find().sort({ createdAt: -1 }).limit(200);
  res.json(list);
});

export default router;
