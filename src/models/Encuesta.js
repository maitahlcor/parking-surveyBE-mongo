import mongoose from "mongoose";

const EncuestaSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: ["usuario", "local"], required: true },
    esPrueba: { type: Boolean, default: false },
    coords: { lat: Number, lng: Number },       // opcional
    encuestadorId: { type: Number },            // opcional (tu numericId de usuario)
    inicio: { type: Date, default: Date.now },
    fin: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model("Encuesta", EncuestaSchema);

