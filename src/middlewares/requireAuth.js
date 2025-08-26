import { verifyJwt } from "../utils/jwt.js";

export function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    let token = null;

    // 1) Cookie HttpOnly
    if (req.cookies?.token) token = req.cookies.token;

    // 2) Authorization: Bearer <token>
    if (!token && auth?.startsWith("Bearer ")) token = auth.slice(7);

    if (!token) return res.status(401).json({ error: "No autenticado" });

    const payload = verifyJwt(token);
    req.user = payload; // { id, email, numericId, name }
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}
