import mongoose from "mongoose";
import Counter from "./Counter.js";

const UsuarioSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, index: true },
  passwordHash: { type: String, required: true },     // <- REQUERIDO
  numericId: { type: Number, unique: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

// Autoincremento del numericId
UsuarioSchema.pre("save", async function (next) {
  if (this.numericId) return next();
  const c = await Counter.findOneAndUpdate(
    { key: "usuario" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  this.numericId = c.seq;
  next();
});

export default mongoose.model("Usuario", UsuarioSchema);
