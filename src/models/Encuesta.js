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
    tipo: {
      type: String,
      enum: ["usuarios", "locales", "TransportePublico"],
      required: true,
    },

    // NUEVOS CAMPOS 👇
    subtipo: { type: String },                 // p.ej. "Residencial"
    code: { type: String, index: true },       // si quieres, usa unique: true
    answeredCount: { type: Number, default: 0 },
    empresaEncuestadora: { type: String, enum: ["MJ", "C&A", "Global"], required: true },
    isTest: { type: Boolean, default: false, required: true },
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

export default mongoose.model("Encuesta", EncuestaSchema);
