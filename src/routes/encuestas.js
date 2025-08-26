import { Router } from "express";

const router = Router();

// SIEMPRE paths relativos con slash inicial
router.post("/", async (req, res) => {
  // crear encuesta
  res.json({ ok: true, encuestaId: "demo" });
});

router.patch("/:id/finalizar", async (req, res) => {
  // finalizar encuesta
  res.json({ ok: true });
});

export default router;
