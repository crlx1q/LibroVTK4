import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");

const ensureDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const filePath = (name) => path.join(dataDir, name);

export const readJson = (name, fallback) => {
  ensureDir();
  const target = filePath(name);
  if (!fs.existsSync(target)) {
    fs.writeFileSync(target, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  const raw = fs.readFileSync(target, "utf-8");
  if (!raw) {
    fs.writeFileSync(target, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  return JSON.parse(raw);
};

export const writeJson = (name, data) => {
  ensureDir();
  const target = filePath(name);
  fs.writeFileSync(target, JSON.stringify(data, null, 2));
};
