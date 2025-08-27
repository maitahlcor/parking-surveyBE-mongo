// src/routes/encuestas.js
import { Router } from "express";
import mongoose from "mongoose";
import Encuesta from "../models/Encuesta.js";
import Respuesta from "../models/Respuesta.js";

const router = Router();

// Crear encuesta
router.post("/", async (req, res) => {
  try {
    const { tipo = "usuario", esPrueba = false, coords, encuestadorId } = req.body;
    const encuesta = await Encuesta.create({
      tipo,
      esPrueba,
      coordenadas: coords,
      encuestadorId: encuestadorId ?? undefined,
      inicio: new Date(),
    });
    return res.status(201).json({ ok: true, encuestaId: encuesta._id.toString() });
  } catch (err) {
    console.error("Error creando encuesta:", err);
    return res.status(400).json({ ok: false, error: "No se pudo crear la encuesta" });
  }
});

// Finalizar encuesta (opcionalmente guarda respuestas)
router.patch("/:id/finalizar", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido" });
    }
    const { respuestas = [] } = req.body;

    const encuesta = await Encuesta.findByIdAndUpdate(
      id,
      { fin: new Date() },
      { new: true }
    );
    if (!encuesta) return res.status(404).json({ ok: false, error: "Encuesta no encontrada" });

    let inserted = 0;
    if (Array.isArray(respuestas) && respuestas.length) {
      const docs = respuestas.map(r => ({
        encuesta: id,
        name: r.name,
        title: r.title,
        type: r.type,
        value: r.value,
        ...(r.meta ? { meta: r.meta } : {}),
      }));
      const result = await Respuesta.insertMany(docs);
      inserted = result.length;
    }

    return res.json({ ok: true, respuestasGuardadas: inserted });
  } catch (err) {
    console.error("Error finalizando encuesta:", err);
    return res.status(500).json({ ok: false, error: "Error finalizando encuesta" });
  }
});

export default router;
