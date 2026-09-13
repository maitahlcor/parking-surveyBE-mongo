// src/routes/encuestas.js
import { Router } from "express";
import Encuesta from "../models/Encuesta.js";
import Usuario from "../models/Usuario.js";
import { buildRespuestasCsv, buildRespuestasXlsx } from "../utils/exportRespuestas.js";

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

const TIPO_PRPD = "PRPD_uraba";
const PRPD_DESDE = "2026-09-01";

function rangoDiaBogota(fecha) {
  const day =
    fecha && /^\d{4}-\d{2}-\d{2}$/.test(String(fecha))
      ? String(fecha)
      : new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const start = new Date(`${day}T00:00:00-05:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { day, start, end };
}

function enUrabaAntioquia(lat, lng) {
  return lat >= 7.15 && lat <= 8.95 && lng >= -77.05 && lng <= -76.15;
}

function pairFromGeo(geo) {
  const coords = geo?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function normalizeCedula(value) {
  return String(value || "").replace(/\D/g, "");
}

function cedulaValida(value) {
  const digits = normalizeCedula(value);
  return digits.length >= 6 && digits.length <= 12 ? digits : null;
}

function cedulaDesdeBody(body, respuestas) {
  const hit = (respuestas || []).find((r) => r?.name === "cc_encuestador");
  return cedulaValida(body?.cc_encuestador ?? hit?.value);
}

function cedulaFrom(doc) {
  const hit = (doc.respuestas || []).find((r) => r?.name === "cc_encuestador");
  const raw = hit?.value != null && String(hit.value).trim()
    ? String(hit.value).trim()
    : null;
  return normalizeCedula(raw) || raw;
}

async function requireSeguimiento(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return null;
  }
  const user = await Usuario.findById(req.session.userId).select("email role");
  if (!user) {
    res.status(401).json({ error: "No autenticado" });
    return null;
  }
  if ((user.role || "encuestador") !== "seguimiento") {
    res.status(403).json({ error: "Sin permiso de seguimiento" });
    return null;
  }
  return user;
}

function rangoFechasBogota(desde, hasta) {
  const min = rangoDiaBogota(PRPD_DESDE);
  const a = rangoDiaBogota(desde);
  const b = rangoDiaBogota(hasta || desde);
  let start = a.start <= b.start ? a.start : b.start;
  const end = a.end >= b.end ? a.end : b.end;
  if (start < min.start) start = min.start;
  const maxMs = 400 * 24 * 60 * 60 * 1000;
  if (end - start > maxMs) {
    const err = new Error("El rango no puede superar 400 días");
    err.status = 400;
    throw err;
  }
  return {
    desde: start.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }),
    hasta: new Date(end.getTime() - 1).toLocaleDateString("en-CA", {
      timeZone: "America/Bogota",
    }),
    start,
    end,
  };
}

function filtroRango(start, end) {
  return {
    $or: [
      { createdAt: { $gte: start, $lt: end } },
      { finishedAt: { $gte: start, $lt: end } },
      { startedAt: { $gte: start, $lt: end } },
    ],
  };
}

function filtroPrpdRango(start, end) {
  return { tipo: TIPO_PRPD, ...filtroRango(start, end) };
}

function preguntasCount(doc) {
  if (typeof doc.answeredCount === "number" && doc.answeredCount > 0) {
    return doc.answeredCount;
  }
  const resps = (doc.respuestas || []).filter(
    (r) => r?.name && r.name !== "cc_encuestador"
  );
  return uniqueAnsweredCount(resps);
}

function duracionSegundos(doc) {
  const ini = doc.startedAt || doc.createdAt;
  const fin = doc.finishedAt;
  if (!ini || !fin) return null;
  const ms = new Date(fin) - new Date(ini);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 1000);
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
    if (!(await requireSeguimiento(req, res))) return;

    let rango;
    try {
      if (req.query.desde || req.query.hasta) {
        rango = rangoFechasBogota(req.query.desde, req.query.hasta);
      } else {
        const one = rangoDiaBogota(req.query.fecha);
        rango = { desde: one.day, hasta: one.day, start: one.start, end: one.end };
      }
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
    const filtro = filtroPrpdRango(rango.start, rango.end);
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
      if (!geo || !enUrabaAntioquia(geo.lat, geo.lng)) continue;
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
      fecha: rango.hasta,
      desde: rango.desde,
      hasta: rango.hasta,
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

// GET /api/encuestas/seguimiento/cedulas
router.get("/seguimiento/cedulas", async (req, res) => {
  try {
    if (!(await requireSeguimiento(req, res))) return;
    const { start } = rangoDiaBogota(PRPD_DESDE);
    const rows = await Encuesta.aggregate([
      {
        $match: {
          tipo: TIPO_PRPD,
          finishedAt: { $gte: start },
        },
      },
      { $unwind: "$respuestas" },
      { $match: { "respuestas.name": "cc_encuestador" } },
      {
        $project: {
          cedula: {
            $trim: { input: { $toString: { $ifNull: ["$respuestas.value", ""] } } },
          },
        },
      },
      { $match: { cedula: { $ne: "" } } },
      { $group: { _id: "$cedula", total: { $sum: 1 } } },
      { $sort: { total: -1, _id: 1 } },
    ]);
    const byCedula = new Map();
    for (const r of rows) {
      const cedula = normalizeCedula(r._id) || String(r._id);
      byCedula.set(cedula, (byCedula.get(cedula) || 0) + r.total);
    }
    const cedulas = [...byCedula.entries()]
      .map(([cedula, total]) => ({ cedula, total }))
      .sort((a, b) => b.total - a.total || a.cedula.localeCompare(b.cedula));
    return res.json({ ok: true, cedulas });
  } catch (e) {
    console.error("Error cedulas seguimiento:", e);
    return res.status(500).json({ error: "No se pudieron listar las cédulas" });
  }
});

// GET /api/encuestas/seguimiento/detalle?cedula=&desde=&hasta=
router.get("/seguimiento/detalle", async (req, res) => {
  try {
    if (!(await requireSeguimiento(req, res))) return;
    const rawCedula = String(req.query.cedula || "").trim();
    const cedula = normalizeCedula(rawCedula);
    const sinCedula =
      !cedula &&
      (rawCedula === "(sin cédula)" || rawCedula.toLowerCase() === "sin cedula");
    if (!cedula && !sinCedula) {
      return res.status(400).json({ error: "Indica una cédula" });
    }

    let rango;
    try {
      rango = rangoFechasBogota(req.query.desde, req.query.hasta);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    const docs = await Encuesta.find(filtroPrpdRango(rango.start, rango.end))
      .select("code tipo isTest startedAt finishedAt createdAt answeredCount respuestas")
      .sort({ startedAt: 1, createdAt: 1 })
      .lean();

    const encuestas = docs
      .filter((doc) => {
        const value = normalizeCedula(cedulaFrom(doc));
        return sinCedula ? !value : value === cedula;
      })
      .map((doc) => {
        const inicio = doc.startedAt || doc.createdAt || null;
        const fin = doc.finishedAt || null;
        return {
          id: String(doc._id),
          code: doc.code || null,
          tipo: doc.tipo || null,
          isTest: doc.isTest === true,
          finalizada: !!fin,
          inicio: inicio ? new Date(inicio).toISOString() : null,
          fin: fin ? new Date(fin).toISOString() : null,
          duracion_s: duracionSegundos(doc),
          preguntas: preguntasCount(doc),
        };
      });

    return res.json({
      ok: true,
      cedula: sinCedula ? "(sin cédula)" : cedula,
      desde: rango.desde,
      hasta: rango.hasta,
      total: encuestas.length,
      encuestas,
    });
  } catch (e) {
    console.error("Error detalle seguimiento:", e);
    return res.status(500).json({ error: "No se pudo leer el detalle" });
  }
});

// GET /api/encuestas/seguimiento/csv — respuestas desde septiembre 2026
router.get("/seguimiento/csv", async (req, res) => {
  try {
    if (!(await requireSeguimiento(req, res))) return;
    const { start } = rangoDiaBogota(PRPD_DESDE);
    const end = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const docs = await Encuesta.find(filtroRango(start, end))
      .select("code tipo isTest startedAt finishedAt answeredCount respuestas")
      .sort({ startedAt: 1, createdAt: 1 })
      .lean();
    const csv = buildRespuestasCsv(docs);
    const day = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Bogota",
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="encuestas-respuestas-${day}.csv"`
    );
    return res.send(csv);
  } catch (e) {
    console.error("Error csv seguimiento:", e);
    return res.status(500).json({ error: "No se pudo generar el CSV" });
  }
});

// GET /api/encuestas/seguimiento/xlsx — respuestas + diccionario de preguntas
router.get("/seguimiento/xlsx", async (req, res) => {
  try {
    if (!(await requireSeguimiento(req, res))) return;
    const { start } = rangoDiaBogota(PRPD_DESDE);
    const end = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const docs = await Encuesta.find(filtroRango(start, end))
      .select("code tipo isTest startedAt finishedAt createdAt answeredCount respuestas")
      .sort({ startedAt: 1, createdAt: 1 })
      .lean();
    const xlsx = buildRespuestasXlsx(docs);
    const day = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Bogota",
    });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="encuestas-respuestas-${day}.xlsx"`
    );
    return res.send(xlsx);
  } catch (e) {
    console.error("Error xlsx seguimiento:", e);
    return res.status(500).json({ error: "No se pudo generar el Excel" });
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
    const cedula = cedulaDesdeBody(req.body, req.body.respuestas);
    if (!cedula) {
      return res.status(400).json({
        error: "La cédula del encuestador es obligatoria (6 a 12 dígitos).",
      });
    }

    const empresa = normalizeEmpresa(
      req.body.empresaEncuestadora ?? req.body.empresa ?? req.body.encuestadora
    );

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
      tipo,
      subtipo,
      createdBy,
      empresaEncuestadora: empresa || undefined,
      isTest,
      startedAt: new Date(),
      coordsStart: toGeo(req.body, "start."),
      respuestas: [
        {
          name: "cc_encuestador",
          title: "Cédula del encuestador",
          type: "cc_encuestador",
          value: cedula,
        },
      ],
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
    const cedula = cedulaDesdeBody(req.body, doc.respuestas);
    if (!cedula) {
      return res.status(400).json({
        ok: false,
        error: "La cédula del encuestador es obligatoria (6 a 12 dígitos).",
      });
    }
    const hasCc = (doc.respuestas || []).some((r) => r?.name === "cc_encuestador");
    if (!hasCc) {
      doc.respuestas = [
        ...(doc.respuestas || []),
        {
          encuestaId: doc._id,
          name: "cc_encuestador",
          title: "Cédula del encuestador",
          type: "cc_encuestador",
          value: cedula,
        },
      ];
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
