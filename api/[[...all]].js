// api/[[...all]].js
import app from "../src/index.js";

export default function handler(req, res) {
  return app(req, res);   // Express maneja /api y /api/*
}
