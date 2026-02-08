import jwt from "jsonwebtoken";

const accessSecret = process.env.ACCESS_SECRET || "vtk_access_secret";
const refreshSecret = process.env.REFRESH_SECRET || "vtk_refresh_secret";

export const createAccessToken = (payload) => jwt.sign(payload, accessSecret, { expiresIn: "20m" });
export const createRefreshToken = (payload) => jwt.sign(payload, refreshSecret, { expiresIn: "14d" });

export const verifyAccess = (token) => jwt.verify(token, accessSecret);
export const verifyRefresh = (token) => jwt.verify(token, refreshSecret);

export const authRequired = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }
  try {
    const payload = verifyAccess(token);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Срок сессии истек" });
  }
};

export const roleRequired = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  return next();
};
