// src/routes/encuestas.js
import { Router } from "express";
import Encuesta from "../models/Encuesta.js";
import Usuario from "../models/Usuario.js";

const router = Router();

function toGeo(body, prefix = "") {
  const lat = body?.[`${prefix}lat`] ?? body?.lat;
  const lng = body?.[`${prefix}lng`] ?? body?.lng;
  if (lat == null || lng == null) return undefined;
  const nlat = Number(lat), nlng = Number(lng);
  if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) return undefined;
  return { type: "Point", coordinates: [nlng, nlat] };
}

// Normaliza "empresa encuestadora" a uno de los tres valores permitidos
function normalizeTipo(v) {
  const key = (v ?? "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (key === "usuarios") return "usuarios";
  if (key === "locales" || key === "transportepublico") return "locales";
  if (key === "prpd_uraba" || key === "prpduraba") return "PRPD_uraba";
  return null;
}

function mergeRespuestas(existing, incoming, encuestaId) {
  const byName = new Map();
  for (const r of existing || []) {
    if (r?.name) byName.set(String(r.name), r);
  }
  for (const r of incoming || []) {
    if (!r?.name) continue;
    byName.set(String(r.name), { ...r, encuestaId });
  }
  return Array.from(byName.values());
}

function uniqueAnsweredCount(respuestas = []) {
  const set = new Set();
  for (const r of respuestas) {
    const name = String(r?.name || "");
    if (!name) continue;
    if (name.startsWith("escenario:")) {
      const parts = name.split(":");
      set.add(`${parts[0]}:${parts[1] || ""}`);
    } else {
      set.add(name.split(":")[0]);
    }
  }
  return set.size;
}

function normalizeEmpresa(v) {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  if (/^mj$/i.test(s)) return "MJ";
  if (/^(c\s*&\s*a|c&a)$/i.test(s)) return "C&A";
  if (/^global$/i.test(s)) return "Global";
  return null;
}

// GET /api/encuestas/export — JSON de toda la colección
router.get("/export", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "No autenticado" });
    }
    const docs = await Encuesta.find({}).lean();
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="encuestas-${day}.json"`
    );
    return res.json(docs);
  } catch (e) {
    console.error("Error export encuestas:", e);
    return res.status(500).json({ error: "No se pudo exportar" });
  }
});

function rangoDiaBogota(fecha) {
  const day =
    fecha && /^\d{4}-\d{2}-\d{2}$/.test(String(fecha))
      ? String(fecha)
      : new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const start = new Date(`${day}T00:00:00-05:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { day, start, end };
}

function pairFromGeo(geo) {
  const coords = geo?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function cedulaFrom(doc) {
  const hit = (doc.respuestas || []).find((r) => r?.name === "cc_encuestador");
  return hit?.value != null && String(hit.value).trim()
    ? String(hit.value).trim()
    : null;
}

function horaBogota(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const part = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(d)
    .find((p) => p.type === "hour");
  const hora = Number(part?.value);
  return Number.isFinite(hora) ? hora : null;
}

function momentoEnvio(doc) {
  return doc.finishedAt || doc.startedAt || doc.createdAt || null;
}

// GET /api/encuestas/seguimiento — totales + puntos GPS del día (rol seguimiento)
router.get("/seguimiento", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "No autenticado" });
    }
    const user = await Usuario.findById(req.session.userId).select("email role");
    if (!user) return res.status(401).json({ error: "No autenticado" });
    if ((user.role || "encuestador") !== "seguimiento") {
      return res.status(403).json({ error: "Sin permiso de seguimiento" });
    }

    const { day, start, end } = rangoDiaBogota(req.query.fecha);
    const filtro = {
      $or: [
        { createdAt: { $gte: start, $lt: end } },
        { finishedAt: { $gte: start, $lt: end } },
        { startedAt: { $gte: start, $lt: end } },
      ],
    };
    const docs = await Encuesta.find(filtro).lean();

    const puntos = [];
    const porTipo = {};
    const porCedula = {};
    let finalizadas = 0;
    let conGps = 0;
    let isTest = 0;

    for (const doc of docs) {
      const tipo = String(doc.tipo || "otro");
      porTipo[tipo] = (porTipo[tipo] || 0) + 1;
      const cerrada = !!doc.finishedAt;
      const prueba = doc.isTest === true;
      if (cerrada) finalizadas += 1;
      if (prueba) isTest += 1;

      const cedula = cedulaFrom(doc) || "(sin cédula)";
      if (!porCedula[cedula]) {
        porCedula[cedula] = {
          cedula,
          total: 0,
          abiertas: 0,
          finalizadas: 0,
          prueba: 0,
        };
      }
      porCedula[cedula].total += 1;
      if (cerrada) porCedula[cedula].finalizadas += 1;
      else porCedula[cedula].abiertas += 1;
      if (prueba) porCedula[cedula].prueba += 1;

      const geo = pairFromGeo(doc.coordsEnd) || pairFromGeo(doc.coordsStart);
      if (!geo) continue;
      conGps += 1;
      const enviada = momentoEnvio(doc);
      puntos.push({
        id: String(doc._id),
        code: doc.code || null,
        tipo,
        isTest: prueba,
        finalizada: cerrada,
        cedula: cedulaFrom(doc),
        hora: horaBogota(enviada),
        enviada_at: enviada ? new Date(enviada).toISOString() : null,
        lat: geo.lat,
        lng: geo.lng,
      });
    }

    const tabla_cedula = Object.values(porCedula).sort((a, b) => b.total - a.total);

    return res.json({
      ok: true,
      fecha: day,
      total: docs.length,
      finalizadas,
      abiertas: docs.length - finalizadas,
      con_gps: conGps,
      isTest,
      por_tipo: porTipo,
      tabla_cedula,
      puntos,
    });
  } catch (e) {
    console.error("Error seguimiento:", e);
    return res.status(500).json({ error: "No se pudo leer el seguimiento" });
  }
});

// POST /api/encuestas/start
router.post("/start", async (req, res) => {
  try {
    const tipo = normalizeTipo(req.body.tipo);
    const { subtipo } = req.body;
    if (!tipo) {
      return res.status(400).json({
        error: "tipo es requerido (usuarios | locales | TransportePublico | PRPD_uraba)",
      });
    }

    // leer y normalizar flags/metas
    const empresaRaw =
      req.body.empresaEncuestadora ??
      req.body.empresa ??
      req.body.encuestadora;

    const empresa = normalizeEmpresa(empresaRaw);
    if (!empresa) {
      return res
        .status(400)
        .json({ error: "empresaEncuestadora inválida o faltante (MJ | C&A | Global)" });
    }

    const isTest =
      req.body.isTest === true
        ? true
        : req.body.esPrueba === true
        ? true
        : false; // nunca null/undefined

    const createdByRaw =
      req.user?._id ||
      req.session?.userId ||
      req.session?.user?._id ||
      req.body.createdBy ||
      null;
    const createdBy = /^[a-fA-F0-9]{24}$/.test(String(createdByRaw || ""))
      ? String(createdByRaw)
      : null;

    const encuesta = new Encuesta({
      tipo,                // "usuarios" | "locales"
      subtipo,             // "Residencial", "Comercio/Establecimiento", etc.
      createdBy,
      empresaEncuestadora: empresa,   // <-- guardamos empresa
      isTest,                         // <-- boolean garantizado
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
      empresaEncuestadora,   // puede venir en finalizar (reconfirmación)
      empresa,               // alias opcional
      encuestadora           // alias opcional
    } = req.body;

    const doc = await Encuesta.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: "not found" });

    if (Array.isArray(respuestas) && respuestas.length) {
      doc.respuestas = respuestas.map((r) => ({ ...r, encuestaId: doc._id }));
    }

    // tiempos y coords final
    if (finishedAt) doc.finishedAt = new Date(finishedAt);
    if (endLat != null && endLng != null) {
      const nlat = Number(endLat), nlng = Number(endLng);
      if (Number.isFinite(nlat) && Number.isFinite(nlng)) {
        doc.coordsEnd = { type: "Point", coordinates: [nlng, nlat] };
      }
    }

    // answeredCount: usa el provisto o calcula
    if (typeof answeredCount === "number") {
      doc.answeredCount = answeredCount;
    } else {
      doc.answeredCount = uniqueAnsweredCount(doc.respuestas);
    }

    // code: usa el provisto o genera si no existía
    if (code) {
      doc.code = String(code);
    } else if (!doc.code) {
      const kind = doc.tipo === "usuarios" ? "USR" : "LOC";
      const short = (doc.subtipo || "GEN").split(/[\/\s\+]/)[0].slice(0, 4).toUpperCase();
      const ts = Math.floor(Date.now() / 1000); // segundos
      doc.code = `${kind}-${short}-${ts}`;
    }

    // bandera de prueba (acepta isTest o esPrueba) → siempre boolean
    if (typeof isTest === "boolean") {
      doc.isTest = isTest;
    } else if (typeof esPrueba === "boolean") {
      doc.isTest = esPrueba;
    } // si no vino, no lo toques (se mantiene lo de /start)

    // empresa: si llega válida, actualiza (por si quieres rectificar en finalizar)
    const empresaIn = normalizeEmpresa(empresaEncuestadora ?? empresa ?? encuestadora);
    if (empresaIn) {
      doc.empresaEncuestadora = empresaIn;
    }

    await doc.save();

    return res.json({
      ok: true,
      id: doc._id,
      code: doc.code,
      answeredCount: doc.answeredCount,
      isTest: doc.isTest,
      empresaEncuestadora: doc.empresaEncuestadora,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// PATCH /api/encuestas/:id/respuestas — upsert parcial por name
router.patch("/:id/respuestas", async (req, res) => {
  try {
    const doc = await Encuesta.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: "not found" });
    const respuestas = Array.isArray(req.body?.respuestas) ? req.body.respuestas : [];
    if (respuestas.length) {
      doc.respuestas = mergeRespuestas(doc.respuestas, respuestas, doc._id);
      doc.answeredCount = uniqueAnsweredCount(doc.respuestas);
    }
    await doc.save();
    return res.json({
      ok: true,
      id: doc._id,
      answeredCount: doc.answeredCount,
      n_respuestas: (doc.respuestas || []).length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
