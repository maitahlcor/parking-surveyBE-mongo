// src/routes/encuestas.js
import { Router } from "express";
import mongoose from "mongoose";
import Encuesta from "../models/Encuesta.js";
import Respuesta from "../models/Respuesta.js";

const router = Router();
console.log("[encuestas.js] router REAL cargado");

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

// Finalizar encuesta
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

    if (respuestas.length) {
      await Respuesta.insertMany(respuestas.map(r => ({ ...r, encuesta: id })));
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error finalizando encuesta" });
  }
});

export default router;  // <-- ¡ESTO FALTABA!
