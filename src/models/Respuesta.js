import mongoose from "mongoose";

const RespuestaSchema = new mongoose.Schema({
  encuesta: { type: mongoose.Schema.Types.ObjectId, ref: "Encuesta", index: true },
  preguntaCodigo: { type: String, index: true }, // o pregunta: ref a Pregunta
  valor: mongoose.Schema.Types.Mixed,            // string/array/objeto
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Respuesta", RespuestaSchema);
