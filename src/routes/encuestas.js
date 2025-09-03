// src/routes/encuestas.js (ESM)
import { Router } from "express";
import Encuesta from "../models/Encuesta.js";

const router = Router();

function toGeo(body, prefix = "") {
  const lat = body?.lat ?? body?.[`${prefix}lat`];
  const lng = body?.lng ?? body?.[`${prefix}lng`];
  if (typeof lat === "number" && typeof lng === "number") {
    return { type: "Point", coordinates: [lng, lat] }; // GeoJSON [lng, lat]
  }
  return undefined;
}

// POST /api/encuestas/start
router.post("/start", async (req, res) => {
  try {
    const { tipo } = req.body;
    if (!tipo) return res.status(400).json({ error: "tipo es requerido" });

    const createdBy = req.user?._id || req.body.createdBy || null; // ajusta a tu auth real

    const encuesta = new Encuesta({
      tipo,
      createdBy,
      startedAt: new Date(),
      coordsStart: toGeo(req.body, "start."),
    });

    await encuesta.save();
    res.status(201).json(encuesta);
  } catch (e) {
    console.error("Error start:", e);
    res.status(500).json({ error: "No se pudo iniciar la encuesta" });
  }
});

// PUT /api/encuestas/:id/finalizar
router.put("/:id/finalizar", async (req, res) => {
  try {
    const { id } = req.params;
    const { respuestas = [], finishedAt } = req.body;

    const respuestasConId = (Array.isArray(respuestas) ? respuestas : []).map((r) => ({
      ...r,
      encuestaId: id,
    }));

    const update = {
      finishedAt: finishedAt ? new Date(finishedAt) : new Date(),
      coordsEnd: toGeo(req.body, "end."),
      $push: { respuestas: { $each: respuestasConId } },
    };

    const encuesta = await Encuesta.findByIdAndUpdate(id, update, { new: true });
    if (!encuesta) return res.status(404).json({ error: "Encuesta no encontrada" });

    res.json(encuesta);
  } catch (e) {
    console.error("Error finalizar:", e);
    res.status(500).json({ error: "No se pudo finalizar la encuesta" });
  }
});

export default router;
