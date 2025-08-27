import mongoose from "mongoose";
import Counter from "./Counter.js";

const UsuarioSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  numericId: { type: Number, unique: true, sparse: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

// Auto-increment al crear
UsuarioSchema.pre("save", async function (next) {
  try {
    if (this.isNew && !this.numericId) {
      const c = await Counter.findOneAndUpdate(
        { key: "usuario" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      this.numericId = c.seq;
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.models.Usuario ||
  mongoose.model("Usuario", UsuarioSchema);
