import chalk from "chalk";
import gradient from "gradient-string";

const accent = gradient(["#0ea5e9", "#2563eb", "#1d4ed8"]);
const subtle = chalk.hex("#94a3b8");
const bright = chalk.hex("#e0f2fe");

const statusColor = (status) => {
  if (status >= 500) return chalk.hex("#fca5a5");
  if (status >= 400) return chalk.hex("#fdba74");
  if (status >= 300) return chalk.hex("#facc15");
  return chalk.hex("#34d399");
};

export const logBanner = () => {
  const title = `
  ██╗     ██╗ ██████╗ ██████╗   ██████╗ 
  ██║     ██║ ██╔══██╗██╔══██╗ ██╔═══██╗
  ██║     ██║ ██████╔╝██████╔╝ ██║   ██║
  ██║     ██║ ██╔══██╗██╔══██╗ ██║   ██║
  ███████╗██║ ██████╔╝██║  ██║ ╚██████╔╝
  ╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝  ╚═════╝ 
  `;
  console.log("\n" + accent.multiline(title));
  console.log(`${bright("✦ Welcome to") } ${accent("LIBRO SERVER")}\n`);
};

export const logInfo = (message, label = "info") => {
  const tag = chalk.bgHex("#1e293b").hex("#60a5fa")(" " + label.toUpperCase() + " ");
  console.log(tag + " " + bright(message));
};

export const logError = (message, error) => {
  const tag = chalk.bgHex("#7f1d1d").hex("#fecdd3")(" ERROR ");
  const body = error ? `${message}: ${chalk.hex("#fecdd3")(error.message || error)}` : message;
  console.error(tag + " " + body);
};

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const color = statusColor(res.statusCode);
    const method = chalk.hex("#a5b4fc")(req.method.padEnd(6));
    const status = color(String(res.statusCode).padEnd(3));
    const path = bright(req.originalUrl || req.url);
    const time = subtle(`${duration}ms`);
    console.log(`${chalk.bgHex("#0f172a").hex("#38bdf8")(" API ")} ${method} ${path} ${status} ${time}`);
  });
  next();
};
