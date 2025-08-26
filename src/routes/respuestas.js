import { Router } from "express";

const router = Router();

router.post("/", async (req, res) => {
  // guardar respuestas
  res.json({ ok: true });
});

router.get("/", async (_req, res) => {
  res.json({ ok: true, items: [] });
});

export default router;
