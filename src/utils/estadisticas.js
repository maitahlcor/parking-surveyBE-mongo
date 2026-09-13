import { PREGUNTAS, buildRespuestasTable, describeQuestion } from "./exportRespuestas.js";

const SKIP = new Set(["code", "cedula", "inicio", "fin", "answeredCount", "tipo"]);

function labelOf(value) {
  if (value == null) return "";
  if (typeof value === "object") return "";
  return String(value).trim();
}

function expandValue(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw.map(labelOf).filter(Boolean);
  if (typeof raw === "object") return [];
  const text = String(raw).trim();
  if (!text) return [];
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(labelOf).filter(Boolean);
      return [];
    } catch {
      return [text];
    }
  }
  return [text];
}

function allNumeric(labels) {
  return labels.length > 0 && labels.every((x) => Number.isFinite(Number(x)));
}

function niceStep(span) {
  const raw = span / 6;
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  return [1, 2, 5, 10].map((n) => n * mag).find((n) => n >= raw) || raw;
}

function binNumeric(labels) {
  const nums = labels.map(Number).filter(Number.isFinite);
  if (nums.length < 8) return null;
  const unique = new Set(nums.map((n) => String(n)));
  if (unique.size <= 12) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) return null;
  const step = niceStep(max - min);
  const start = Math.floor(min / step) * step;
  return (value) => {
    const n = Number(value);
    const idx = Math.floor((n - start) / step);
    const a = start + idx * step;
    const b = a + step;
    const fa = Number.isInteger(step) ? String(a) : a.toFixed(1);
    const fb = Number.isInteger(step) ? String(b) : b.toFixed(1);
    return `${fa}–${fb}`;
  };
}

function catalogQuestions() {
  const items = [];
  for (const q of PREGUNTAS) {
    const name = String(q.name);
    if (Array.isArray(q.items) && q.items.length) {
      for (const item of q.items) {
        const key = `p_${name}:${item.name}`;
        const desc = describeQuestion(`${name}:${item.name}`, q.title);
        items.push({
          key,
          abrev: desc.abrev,
          pregunta: desc.pregunta,
          orden: Number(q.orden?.[0]?.orden ?? 999),
        });
      }
    } else {
      const key = `p_${name}`;
      const desc = describeQuestion(name, q.title);
      items.push({
        key,
        abrev: desc.abrev,
        pregunta: desc.pregunta,
        orden: Number(q.orden?.[0]?.orden ?? 999),
      });
    }
  }
  return items;
}

function toOpciones(counts, total) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([label, count]) => ({
      label,
      count,
      pct: total ? Math.round((count / total) * 1000) / 10 : 0,
    }));
}

export function buildEstadisticas(docs) {
  const table = buildRespuestasTable(docs);
  const byKey = new Map();
  const seed = catalogQuestions();
  for (const q of seed) {
    byKey.set(q.key, { ...q, labels: [], answered: 0 });
  }

  for (const key of table.keys) {
    if (SKIP.has(key)) continue;
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        abrev: table.abrevs[key] || key,
        pregunta: table.titles[key] || key,
        orden: key.startsWith("escenario_") ? 1000 : 900,
        labels: [],
        answered: 0,
      });
    }
    const bucket = byKey.get(key);
    for (const row of table.rows) {
      const parts = expandValue(row[key]);
      if (!parts.length) continue;
      bucket.answered += 1;
      bucket.labels.push(...parts);
    }
  }

  const preguntas = [...byKey.values()]
    .map((q) => {
      const bin = allNumeric(q.labels) ? binNumeric(q.labels) : null;
      const counts = new Map();
      for (const label of q.labels) {
        const name = bin ? bin(label) : label;
        counts.set(name, (counts.get(name) || 0) + 1);
      }
      const menciones = q.labels.length;
      return {
        key: q.key,
        abrev: q.abrev,
        pregunta: q.pregunta,
        orden: q.orden,
        n: q.answered,
        menciones,
        opciones: toOpciones(counts, menciones),
      };
    })
    .sort((a, b) => a.orden - b.orden || a.abrev.localeCompare(b.abrev, "es"));

  const finalizadas = docs.filter((d) => d.finishedAt).length;
  return {
    total: docs.length,
    finalizadas,
    abiertas: docs.length - finalizadas,
    preguntas,
  };
}
