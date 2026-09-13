import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { buildXlsxBuffer, colLetter } from "./xlsxMinimal.js";

const META = [
  { key: "code", abrev: "code", pregunta: "Código de la encuesta" },
  { key: "cedula", abrev: "cedula", pregunta: "Cédula del encuestador" },
  { key: "tipo", abrev: "tipo", pregunta: "Tipo de encuesta" },
  { key: "isTest", abrev: "prueba", pregunta: "Es prueba (1 = sí, 0 = no)" },
  { key: "inicio", abrev: "inicio", pregunta: "Fecha y hora de inicio" },
  { key: "fin", abrev: "fin", pregunta: "Fecha y hora de fin" },
  { key: "answeredCount", abrev: "n_preguntas", pregunta: "Número de preguntas contestadas" },
];

const META_KEYS = META.map((m) => m.key);

const questions = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../data/preguntasUsuarios.json"), "utf8")
);

const byName = new Map(questions.map((q) => [String(q.name), q]));

function slug(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "pregunta";
}

function shortOutput(output) {
  if (typeof output !== "string" || !output) return "";
  return output.replace(/_id$/, "");
}

export function describeQuestion(name, fallbackTitle = "") {
  const raw = String(name || "");
  const [base, ...rest] = raw.split(":");
  const sub = rest.join(":");
  const q = byName.get(base);
  if (!q) {
    return {
      abrev: slug(fallbackTitle || raw),
      pregunta: fallbackTitle || raw,
    };
  }
  if (sub && Array.isArray(q.items)) {
    const idx = q.items.findIndex((item) => String(item.name) === sub);
    const item = idx >= 0 ? q.items[idx] : null;
    const fromOutput = Array.isArray(q.output) ? q.output[idx] : "";
    return {
      abrev: shortOutput(fromOutput) || `${shortOutput(q.output) || slug(q.title)}_${sub}`,
      pregunta: `${q.title} · ${item?.title || sub}`,
    };
  }
  if (sub) {
    return {
      abrev: `${shortOutput(q.output) || slug(q.title)}_${slug(sub)}`,
      pregunta: fallbackTitle || `${q.title} · ${sub}`,
    };
  }
  return {
    abrev: shortOutput(q.output) || slug(q.codigo || q.title),
    pregunta: q.title || fallbackTitle || raw,
  };
}

function cedulaFrom(doc) {
  const hit = (doc.respuestas || []).find((r) => String(r?.name || "") === "cc_encuestador");
  return hit?.value != null ? String(hit.value).trim() : "";
}

export function flattenRespuestas(doc) {
  const row = {
    code: doc.code || "",
    cedula: cedulaFrom(doc) || "",
    tipo: doc.tipo || "",
    isTest: doc.isTest === true ? "1" : "0",
    inicio: doc.startedAt || doc.createdAt || "",
    fin: doc.finishedAt || "",
    answeredCount: doc.answeredCount ?? "",
  };
  const titles = Object.fromEntries(META.map((m) => [m.key, m.pregunta]));
  const abrevs = Object.fromEntries(META.map((m) => [m.key, m.abrev]));
  const esc = new Map();
  for (const r of doc.respuestas || []) {
    const name = String(r?.name || "");
    if (!name || name === "cc_encuestador") continue;
    if (name.startsWith("escenario:")) {
      const [, rawId, letraRaw] = name.split(":");
      const id = String(rawId || r?.value?.escenario_id || "");
      if (!id) continue;
      if (!esc.has(id)) esc.set(id, { opciones: {}, eleccion: "" });
      const bucket = esc.get(id);
      const val = r.value && typeof r.value === "object" ? r.value : {};
      const letra = String(letraRaw || val.letra || "").toUpperCase();
      if (letra) bucket.opciones[letra] = val;
      if (val.elegida === 1) bucket.eleccion = letra;
      else if (typeof r.value === "string" && r.value.trim()) {
        bucket.eleccion = r.value.trim().toUpperCase();
      }
      continue;
    }
    const desc = describeQuestion(name, r.title || name);
    const key = `p_${name}`;
    row[key] =
      r.value != null && typeof r.value === "object" ? JSON.stringify(r.value) : r.value ?? "";
    titles[key] = desc.pregunta;
    abrevs[key] = desc.abrev;
  }
  const ids = [...esc.keys()].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  ids.forEach((id, i) => {
    const n = i + 1;
    const bucket = esc.get(id);
    for (const letra of ["A", "B", "C"]) {
      const op = bucket.opciones[letra] || {};
      row[`escenario_${n}_modo_${letra}`] = op.modo ?? "";
      titles[`escenario_${n}_modo_${letra}`] = `Escenario ${n} · ¿Qué modo se mostró en la opción ${letra}?`;
      abrevs[`escenario_${n}_modo_${letra}`] = `esc${n}_modo_${letra}`;
      row[`escenario_${n}_costo_${letra}`] = op.costo ?? "";
      titles[`escenario_${n}_costo_${letra}`] = `Escenario ${n} · ¿Qué costo se mostró en la opción ${letra}?`;
      abrevs[`escenario_${n}_costo_${letra}`] = `esc${n}_costo_${letra}`;
      row[`escenario_${n}_tiempo_${letra}`] = op.tiempo ?? "";
      titles[`escenario_${n}_tiempo_${letra}`] = `Escenario ${n} · ¿Qué tiempo se mostró en la opción ${letra}?`;
      abrevs[`escenario_${n}_tiempo_${letra}`] = `esc${n}_tiempo_${letra}`;
    }
    row[`escenario_${n}_eleccion`] = bucket.eleccion || "";
    titles[`escenario_${n}_eleccion`] = `Escenario ${n} · ¿Qué opción eligió la persona?`;
    abrevs[`escenario_${n}_eleccion`] = `esc${n}_eleccion`;
  });
  return { row, titles, abrevs };
}

function uniqueAbrevs(keys, abrevs) {
  const used = new Set();
  const map = {};
  for (const key of keys) {
    let name = abrevs[key] || key;
    let next = name;
    let i = 2;
    while (used.has(next)) {
      next = `${name}_${i}`;
      i += 1;
    }
    used.add(next);
    map[key] = next;
  }
  return map;
}

export function buildRespuestasTable(docs) {
  const extra = new Set();
  const titles = {};
  const abrevs = {};
  const rows = docs.map((doc) => {
    const flat = flattenRespuestas(doc);
    Object.assign(titles, flat.titles);
    Object.assign(abrevs, flat.abrevs);
    for (const key of Object.keys(flat.row)) {
      if (!META_KEYS.includes(key)) extra.add(key);
    }
    return flat.row;
  });
  const extras = [...extra].sort((a, b) => {
    const ea = a.startsWith("escenario_") ? 1 : 0;
    const eb = b.startsWith("escenario_") ? 1 : 0;
    if (ea !== eb) return ea - eb;
    return a.localeCompare(b, "es", { numeric: true });
  });
  const keys = [...META_KEYS, ...extras];
  return { keys, rows, titles, abrevs: uniqueAbrevs(keys, abrevs) };
}

function csvCell(value) {
  if (value == null || value === "") return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildRespuestasCsv(docs) {
  const { keys, rows, titles, abrevs } = buildRespuestasTable(docs);
  const headerAbrev = keys.map((k) => csvCell(abrevs[k] || k)).join(",");
  const headerTitles = keys.map((k) => csvCell(titles[k] || k)).join(",");
  const body = rows.map((row) => keys.map((k) => csvCell(row[k])).join(",")).join("\n");
  return `\uFEFF${headerAbrev}\n${headerTitles}\n${body}\n`;
}

export function buildRespuestasXlsx(docs) {
  const { keys, rows, titles, abrevs } = buildRespuestasTable(docs);
  const header = keys.map((k) => abrevs[k] || k);
  const respuestasRows = [header, ...rows.map((row) => keys.map((k) => row[k] ?? ""))];
  const preguntasRows = [
    ["Columna", "Abreviatura", "Pregunta"],
    ...keys.map((k, i) => [colLetter(i), abrevs[k] || k, titles[k] || k]),
  ];
  const respuestaWidths = keys.map((k) => Math.min(28, Math.max(12, String(abrevs[k] || k).length + 4)));
  const preguntaWidths = [12, 22, 80];
  return buildXlsxBuffer({
    respuestasRows,
    preguntasRows,
    respuestaWidths,
    preguntaWidths,
  });
}

