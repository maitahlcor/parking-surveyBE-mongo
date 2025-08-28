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
    const { respuestas, escenarios, finalizar = true } = req.body;

    // 1) Actualiza la encuesta (sin borrar nada si no te lo mandan)
    const setUpdate = {};
    if (finalizar) {
      setUpdate.estado = "finalizada";
      setUpdate.finalizadaAt = new Date();
    }
    const encuesta = await Encuesta.findByIdAndUpdate(id, { $set: setUpdate }, { new: true });
    if (!encuesta) return res.status(404).json({ error: "Encuesta no encontrada" });

    // 2) Prepara operaciones en la colección RESPUESTAS
    const ops = [];

    // a) Preguntas normales (array de {name,title,type,value})
    if (Array.isArray(respuestas) && respuestas.length) {
      for (const r of respuestas) {
        ops.push({
          updateOne: {
            filter: { encuesta: new mongoose.Types.ObjectId(id), name: r.name },
            update: {
              $set: {
                encuesta: id,
                name: r.name,
                title: r.title ?? null,
                type: r.type ?? "text",
                value: r.value ?? null,
              },
            },
            upsert: true,
          },
        });
      }
    }

    // b) Escenarios: { version, completo, respuestas: [{EscenarioID, opcion}] }
    if (escenarios?.version && Array.isArray(escenarios.respuestas)) {
      const version = Number(escenarios.version);
      for (const r of escenarios.respuestas) {
        const escenarioId = Number(r.EscenarioID);
        ops.push({
          updateOne: {
            filter: { encuesta: new mongoose.Types.ObjectId(id), escenarioId },
            update: {
              $set: {
                encuesta: id,
                type: "escenario",
                version,
                escenarioId,
                // guardamos la opción elegida (A/B/C) como value para mantener consistencia
                value: r.opcion ?? null,
              },
            },
            upsert: true,
          },
        });
      }
    }

    if (ops.length) {
      await Respuesta.bulkWrite(ops, { ordered: false }); // ordered:false = continúa aunque haya conflictos puntuales
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error finalizando encuesta" });
  }
});
export default router;
