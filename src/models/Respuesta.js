import mongoose from "mongoose";

const RespuestaSchema = new mongoose.Schema(
  {
    // 🔗 vínculo con la encuesta a la que pertenece esta respuesta
    encuesta: { type: mongoose.Schema.Types.ObjectId, ref: "Encuesta", required: true, index: true },

    // preguntas "normales"
    name:  { type: String },                 // id de la pregunta (en el FE)
    title: { type: String },
    type:  { type: String, enum: ["radiogroup", "ranking", "checkbox", "text", "comment", "rating", "escenario"], required: true },
    value: { type: mongoose.Schema.Types.Mixed },

    // campos para respuestas de ESCENARIOS (solo si type === "escenario")
    version:     { type: Number },           // código de versión (1..4)
    escenarioId: { type: Number },           // ID del escenario (del JSON)
  },
  { timestamps: true, versionKey: false }
);

// ✅ Evita duplicar la misma pregunta en la misma encuesta
RespuestaSchema.index(
  { encuesta: 1, name: 1 },
  { unique: true, partialFilterExpression: { name: { $type: "string" } } }
);

// ✅ Evita duplicar la misma respuesta de escenario en la misma encuesta
RespuestaSchema.index(
  { encuesta: 1, escenarioId: 1 },
  { unique: true, partialFilterExpression: { escenarioId: { $type: "number" } } }
);

export default mongoose.model("Respuesta", RespuestaSchema);
