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
    // GeoJSON: [lng, lat]
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const EncuestaSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: ["usuarios", "locales"], required: true },
    respuestas: [RespuestaSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    coordsStart: GeoPointSchema,
    coordsEnd: GeoPointSchema,
  },
  { timestamps: true }
);

EncuestaSchema.index({ coordsStart: "2dsphere" });
EncuestaSchema.index({ coordsEnd: "2dsphere" });

export default mongoose.model("Encuesta", EncuestaSchema);
