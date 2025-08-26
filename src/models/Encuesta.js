import mongoose from "mongoose";

const EncuestaSchema = new mongoose.Schema({
  esPrueba: { type: Boolean, default: false },
  tipo: { type: String, enum: ["USUARIO", "LOCAL"], required: true },
  coordenadas: {
    lat: Number,
    lng: Number
  },
  encuestadorId: { type: Number, required: true }, // ID del realizador (numérico)
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", default: null },
  inicio: { type: Date, default: Date.now },
  fin: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model("Encuesta", EncuestaSchema);
