// src/models/Respuesta.js
import mongoose from "mongoose";

const RespuestaSchema = new mongoose.Schema(
  {
    encuesta: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Encuesta",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    title: { type: String },
    type: { type: String, required: true },         // sin enum
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

export default mongoose.model("Respuesta", RespuestaSchema);
