import mongoose from "mongoose";

const PreguntaSchema = new mongoose.Schema({
  codigo: { type: String, index: true },  // ej: "q1", "q17"
  texto: String,
  tipo: String,                 // "radiogroup", "checkbox", "ranking", etc.
  opciones: [String]            // si aplica
}, { timestamps: true });

export default mongoose.model("Pregunta", PreguntaSchema);
