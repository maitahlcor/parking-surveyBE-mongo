// src/models/Encuesta.js
import mongoose from "mongoose";

const RespuestaSchema = new mongoose.Schema(
  {
    encuestaId: { type: mongoose.Schema.Types.ObjectId, ref: "Encuesta" },
    name: String,
    title: String,
    type: String,
    value: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const GeoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number] }, // [lng, lat]
  },
  { _id: false }
);

const EncuestaSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: ["usuarios", "locales"], required: true },
    subtipo: { type: String }, // 👈 NUEVO: Residencial, Comercio/..., etc.
    respuestas: { type: [RespuestaSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    coordsStart: { type: GeoPointSchema, default: undefined },
    coordsEnd: { type: GeoPointSchema, default: undefined },
  },
  { timestamps: true }
);

EncuestaSchema.index({ coordsStart: "2dsphere" });
EncuestaSchema.index({ coordsEnd: "2dsphere" });
EncuestaSchema.index({ tipo: 1, subtipo: 1 });           // 👈 útil para filtrar
EncuestaSchema.index({ createdBy: 1, startedAt: -1 });   // 👈 útil para listados

export default mongoose.model("Encuesta", EncuestaSchema);
