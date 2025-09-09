// src/routes/encuestas.js
import { Router } from "express";
import Encuesta from "../models/Encuesta.js";

const router = Router();

function toGeo(body, prefix = "") {
  const lat = body?.[`${prefix}lat`] ?? body?.lat;
  const lng = body?.[`${prefix}lng`] ?? body?.lng;
  if (lat == null || lng == null) return undefined;
  const nlat = Number(lat), nlng = Number(lng);
  if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) return undefined;
  return { type: "Point", coordinates: [nlng, nlat] };
}


// POST /api/encuestas/start
router.post("/start", async (req, res) => {
  try {
    const { tipo, subtipo, isTest, esPrueba } = req.body;
    if (!tipo) return res.status(400).json({ error: "tipo es requerido" });

    const createdBy =
      req.user?._id ||
      req.session?.userId ||          // 👈 importante
      req.session?.user?._id ||
      req.body.createdBy ||
      null;


    const encuesta = new Encuesta({
      tipo,            // "usuarios" | "locales"
      subtipo,         // 👈 "Residencial", "Comercio/...", etc.
      createdBy,
      isTest: typeof isTest === "boolean" ? isTest :
              typeof esPrueba === "boolean" ? esPrueba : undefined,
      startedAt: new Date(),
      coordsStart: toGeo(req.body, "start."),
    });

    await encuesta.save();
    res.status(201).json(encuesta);
  } catch (e) {
    console.error("Error start encuesta:", e);
    res.status(500).json({ error: "No se pudo iniciar la encuesta" });
  }
});

// PUT /api/encuestas/:id/finalizar
router.put("/:id/finalizar", async (req, res) => {
  try {
    const {
      respuestas = [],
      finishedAt,
      "end.lat": endLat,
      "end.lng": endLng,
      isTest,
      esPrueba,
      answeredCount,
      code,
    } = req.body;

    const doc = await Encuesta.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: "not found" });

    if (Array.isArray(respuestas) && respuestas.length) {
      const items = respuestas.map(r => ({ ...r, encuestaId: doc._id }));
      doc.respuestas.push(...items);
    }

    if (finishedAt) doc.finishedAt = new Date(finishedAt);
    if (endLat != null && endLng != null) {
      const nlat = Number(endLat), nlng = Number(endLng);
      if (Number.isFinite(nlat) && Number.isFinite(nlng)) {
        doc.coordsEnd = { type: "Point", coordinates: [nlng, nlat] };
      }
    }

    // --- NUEVO: fallback ---
    if (typeof answeredCount === "number") {
      doc.answeredCount = answeredCount;
    } else {
      // cuenta únicas con valor no vacío (ignora metas si las hubiera)
      const count = new Set(
        (doc.respuestas || [])
          .filter(r => r?.name && r.value !== undefined && r.value !== "")
          .map(r => String(r.name))
      ).size;
      doc.answeredCount = count;
    }

    if (code) {
      doc.code = String(code);
    } else if (!doc.code) {
      // genera uno si no vino
      const kind = doc.tipo === "usuarios" ? "USR" : "LOC";
      const short = (doc.subtipo || "GEN").split(/[\/\s\+]/)[0].slice(0,4).toUpperCase();
      const ts = Math.floor(Date.now() / 1000); // segundos
      doc.code = `${kind}-${short}-${ts}`;
    }

    await doc.save();
     // ✅ guardar bandera de prueba (acepta isTest o esPrueba)
    if (typeof isTest === "boolean") {
      doc.isTest = isTest;
    } else if (typeof esPrueba === "boolean") {
      doc.isTest = esPrueba;
    }
    return res.json({
      ok: true,
      id: doc._id,
      code: doc.code,
      answeredCount: doc.answeredCount,
      isTest: doc.isTest,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});


export default router;
