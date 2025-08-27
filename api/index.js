// api/index.js
import app from "../src/app.js";

// Vercel invoca esta función para cada request que llegue a /api/*
export default function handler(req, res) {
  return app(req, res);  // Express maneja la request
}
