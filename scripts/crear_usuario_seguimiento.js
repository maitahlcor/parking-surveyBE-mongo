/**
 * Crea o actualiza el usuario de tracking (rol seguimiento).
 * Uso: node scripts/crear_usuario_seguimiento.js
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Usuario from "../src/models/Usuario.js";

const EMAIL = process.env.SEGUIMIENTO_EMAIL || "seguimiento@prpd.test";
const PASSWORD = process.env.SEGUIMIENTO_PASSWORD || "prpd2026";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Falta MONGODB_URI en el .env del backend");
  }
  await mongoose.connect(uri, {
    dbName: process.env.DB_NAME || undefined,
    tlsAllowInvalidCertificates: true,
  });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await Usuario.findOneAndUpdate(
    { email: EMAIL },
    { $set: { email: EMAIL, passwordHash, role: "seguimiento" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log("Usuario de seguimiento listo:", user.email, "rol=", user.role, "id=", String(user._id));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
