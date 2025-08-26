import mongoose from "mongoose";
import Counter from "./Counter.js";

const UsuarioSchema = new mongoose.Schema({
  email: { type: String, unique: true, index: true, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }, // 👈 hash de contraseña
  name: { type: String, default: "" },            // opcional
  numericId: { type: Number, unique: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

// Auto-increment numericId al crear
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
