import mongoose from "mongoose";

const RespuestaSchema = new mongoose.Schema(
  {
    encuesta: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Encuesta",
      required: true,
      index: true,
    },

    // id de la pregunta en el JSON (ej: "q1")
    name: { type: String, required: true },

    // texto de la pregunta (opcional)
    title: { type: String },

    // tipo libre (sin enum)
    type: { type: String, required: true },   // <--- sin enum

    // puede ser string, number, array, objeto, etc.
    value: { type: mongoose.Schema.Types.Mixed, required: true },

    // opcional para guardar metadatos (choices, min/max, etc.)
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

export default mongoose.model("Respuesta", RespuestaSchema);
