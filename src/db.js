import mongoose from "mongoose";

export async function connectDB(uri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { dbName: process.env.DB_NAME || undefined });
  console.log("✅ MongoDB conectado");

  console.log("[mongo] connected to", mongoose.connection.host, "db:", mongoose.connection.name);
}
