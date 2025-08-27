// db.js
import mongoose from "mongoose";

// Reutiliza la conexión entre invocaciones (serverless)
let cached = globalThis.__mongooseConn || { conn: null, promise: null };
globalThis.__mongooseConn = cached;

export async function connectDB(uri) {
  if (!uri) throw new Error("MONGODB_URI is not set");

  // Si ya hay conexión, úsala
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // Primera conexión (o en frío): crea la promesa una sola vez
  if (!cached.promise) {
    mongoose.set("strictQuery", true);

    const dbName = process.env.DB_NAME || undefined; // o fija un nombre, p.ej. "parking"
    cached.promise = mongoose
      .connect(uri, {
        dbName,
        maxPoolSize: 5,
        bufferCommands: false,
        serverSelectionTimeoutMS: 8000, // falla rápido si Atlas no responde
      })
      .then((m) => m.connection);
  }

  // Espera a que resuelva la promesa y cachea la conexión
  cached.conn = await cached.promise;
  return cached.conn;
}
