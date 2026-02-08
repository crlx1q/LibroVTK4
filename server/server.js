import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import { readJson, writeJson } from "./lib/store.js";
import { authRequired, roleRequired, createAccessToken, createRefreshToken, verifyRefresh } from "./lib/auth.js";
import { isEmail, validatePassword, validateRequired } from "./lib/validators.js";
import { logBanner, logInfo, logError, requestLogger } from "./lib/logger.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use((req, res, next) => {
  if (req.path.match(/\.(html|css|js)$/)) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});
app.use(express.static(path.join(__dirname, "..", "client")));
app.use(requestLogger);

const assetsDir = path.join(__dirname, "..", "client", "assets", "covers");
const avatarDir = path.join(__dirname, "..", "client", "assets", "avatars");
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, assetsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const name = `cover_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
    cb(null, name);
  }
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const name = `avatar_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images allowed"), false);
    }
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images allowed"), false);
    }
  }
});

const loadData = () => ({
  users: readJson("users.json", []),
  books: readJson("books.json", []),
  loans: readJson("loans.json", []),
  favorites: readJson("favorites.json", []),
  requests: readJson("requests.json", [])
});

const saveData = (data) => {
  writeJson("users.json", data.users);
  writeJson("books.json", data.books);
  writeJson("loans.json", data.loans);
  writeJson("favorites.json", data.favorites);
  writeJson("requests.json", data.requests);
};

// Хранилище временных QR-кодов для выдачи (TTL 30 минут)
const issueQrCodes = new Map();
const QR_TTL = 30 * 60 * 1000; // 30 минут

// Очистка устаревших QR каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of issueQrCodes) {
    if (now - data.createdAt > QR_TTL) {
      issueQrCodes.delete(code);
    }
  }
}, 5 * 60 * 1000);

const ensureAdmin = async () => {
  const data = loadData();
  if (!data.users.some((user) => user.role === "admin")) {
    const passwordHash = await bcrypt.hash("Admin123", 10);
    data.users.push({
      id: crypto.randomUUID(),
      fullName: "Администратор",
      email: "admin@vtk.local",
      role: "admin",
      group: "",
      registeredAt: new Date().toISOString(),
      passwordHash,
      refreshTokens: [],
      blocked: false,
      qrCodeDataUrl: "",
      phone: "",
      avatarUrl: ""
    });
    saveData(data);
  }
};

const sanitizeUser = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  group: user.group,
  registeredAt: user.registeredAt,
  blocked: user.blocked,
  phone: user.phone || "",
  avatarUrl: user.avatarUrl || ""
});

const computeLoanStatus = (loan) => {
  if (loan.status === "возвращена") {
    return "возвращена";
  }
  const now = new Date();
  const due = new Date(loan.dueDate);
  if (due < now) {
    return "просрочено";
  }
  return "выдана";
};

const updateBookAvailability = (book) => {
  book.availableCopies = Number(book.availableCopies) || 0;
  book.totalCopies = Number(book.totalCopies) || 1;
  if (book.availableCopies <= 0) {
    book.availableCopies = 0;
    book.status = "выдана";
    return;
  }
  if (book.availableCopies >= book.totalCopies) {
    book.availableCopies = book.totalCopies;
  }
  book.status = "доступна";
};

app.post("/api/auth/register", async (req, res) => {
  const data = loadData();
  const { fullName, email, password, group, phone } = req.body;
  if (!validateRequired(fullName) || !isEmail(email) || !validatePassword(password) || !validateRequired(phone)) {
    return res.status(400).json({ message: "Проверьте корректность данных" });
  }
  if (data.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ message: "Пользователь уже существует" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    fullName,
    email,
    role: "student",
    group: group || "",
    phone: phone.trim(),
    registeredAt: new Date().toISOString(),
    passwordHash,
    refreshTokens: [],
    blocked: false,
    qrCodeDataUrl: "",
    avatarUrl: ""
  };
  data.users.push(user);
  saveData(data);
  return res.json({ message: "Регистрация успешна" });
});

app.post("/api/auth/login", async (req, res) => {
  const data = loadData();
  const { email, password } = req.body;
  const user = data.users.find((item) => item.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user) {
    return res.status(401).json({ message: "Неверный email или пароль" });
  }
  if (user.blocked) {
    return res.status(403).json({ message: "Пользователь заблокирован" });
  }
  const valid = await bcrypt.compare(password || "", user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Неверный email или пароль" });
  }
  const accessToken = createAccessToken({ id: user.id, role: user.role, fullName: user.fullName });
  const refreshToken = createRefreshToken({ id: user.id });
  user.refreshTokens = [...(user.refreshTokens || []), refreshToken];
  saveData(data);
  return res.json({
    accessToken,
    refreshToken,
    user: sanitizeUser(user)
  });
});

app.post("/api/auth/refresh", (req, res) => {
  const data = loadData();
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: "Нет токена" });
  }
  try {
    const payload = verifyRefresh(refreshToken);
    const user = data.users.find((item) => item.id === payload.id);
    if (!user || !(user.refreshTokens || []).includes(refreshToken)) {
      return res.status(401).json({ message: "Токен недействителен" });
    }
    const accessToken = createAccessToken({ id: user.id, role: user.role, fullName: user.fullName });
    return res.json({ accessToken });
  } catch (error) {
    return res.status(401).json({ message: "Токен недействителен" });
  }
});

app.post("/api/auth/logout", authRequired, (req, res) => {
  const data = loadData();
  const { refreshToken } = req.body;
  const user = data.users.find((item) => item.id === req.user.id);
  if (user && refreshToken) {
    user.refreshTokens = (user.refreshTokens || []).filter((token) => token !== refreshToken);
    saveData(data);
  }
  return res.json({ message: "Выход выполнен" });
});

app.get("/api/admin/users", authRequired, roleRequired(["admin"]), (req, res) => {
  const data = loadData();
  const { role, search } = req.query;
  let users = data.users;
  if (role) {
    users = users.filter((user) => user.role === role);
  }
  if (search) {
    const target = String(search).toLowerCase();
    users = users.filter((user) => user.fullName.toLowerCase().includes(target) || user.email.toLowerCase().includes(target));
  }
  return res.json(users.map(sanitizeUser));
});

app.post("/api/admin/users", authRequired, roleRequired(["admin"]), async (req, res) => {
  const data = loadData();
  const { fullName, email, password, role, group, phone } = req.body;
  if (!validateRequired(fullName) || !isEmail(email) || !validatePassword(password) || !validateRequired(role)) {
    return res.status(400).json({ message: "Проверьте корректность данных" });
  }
  if (data.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ message: "Email уже используется" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    fullName,
    email,
    role,
    group: group || "",
    phone: phone || "",
    registeredAt: new Date().toISOString(),
    passwordHash,
    refreshTokens: [],
    blocked: false,
    qrCodeDataUrl: "",
    avatarUrl: ""
  };
  data.users.push(user);
  saveData(data);
  return res.json(sanitizeUser(user));
});

const updateUser = (req, res) => {
  const data = loadData();
  const user = data.users.find((item) => item.id === req.params.id);
  if (!user) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }
  const { role, blocked, fullName, group, phone } = req.body;
  if (role) {
    user.role = role;
  }
  if (typeof blocked === "boolean") {
    user.blocked = blocked;
  }
  if (fullName) {
    user.fullName = fullName;
  }
  if (group !== undefined) {
    user.group = group;
  }
  if (typeof phone === "string") {
    user.phone = phone;
  }
  saveData(data);
  return res.json(sanitizeUser(user));
};

app.patch("/api/admin/users/:id", authRequired, roleRequired(["admin"]), updateUser);
app.put("/api/admin/users/:id", authRequired, roleRequired(["admin"]), updateUser);

app.get("/api/admin/loans", authRequired, roleRequired(["admin"]), (req, res) => {
  const data = loadData();
  const enriched = data.loans.map((loan) => {
    const student = data.users.find((user) => user.id === loan.studentId) || {};
    const book = data.books.find((item) => item.id === loan.bookId) || {};
    return {
      ...loan,
      status: computeLoanStatus(loan),
      studentName: student.fullName || "",
      studentEmail: student.email || "",
      bookTitle: book.title || "",
      bookAuthor: book.author || ""
    };
  });
  return res.json(enriched);
});

app.get("/api/admin/stats", authRequired, roleRequired(["admin"]), (req, res) => {
  const data = loadData();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.toDateString());
  const issuedToday = data.loans.filter((loan) => new Date(loan.issueDate) >= todayStart).length;
  const issuedWeek = data.loans.filter((loan) => new Date(loan.issueDate) >= weekAgo).length;
  const overdue = data.loans.filter((loan) => computeLoanStatus(loan) === "просрочено").length;
  const activeLoans = data.loans.filter((loan) => !loan.returnDate).length;
  const popular = data.loans.reduce((acc, loan) => {
    acc[loan.bookId] = (acc[loan.bookId] || 0) + 1;
    return acc;
  }, {});
  const popularBooks = Object.entries(popular)
    .map(([bookId, count]) => {
      const book = data.books.find((item) => item.id === bookId) || {};
      return { bookId, count, title: book.title || "" };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const usersByRole = data.users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});
  const booksByGenre = data.books.reduce((acc, book) => {
    if (book.genre) {
      acc[book.genre] = (acc[book.genre] || 0) + 1;
    }
    return acc;
  }, {});
  const weeklyIssues = [0, 0, 0, 0, 0, 0, 0];
  data.loans.forEach((loan) => {
    const issueDate = new Date(loan.issueDate);
    if (issueDate >= weekAgo) {
      const dayOfWeek = (issueDate.getDay() + 6) % 7;
      weeklyIssues[dayOfWeek]++;
    }
  });
  return res.json({
    totalBooks: data.books.length,
    issuedToday,
    issuedWeek,
    overdue,
    activeLoans,
    popularBooks,
    usersByRole,
    booksByGenre,
    weeklyIssues
  });
});

app.get("/api/librarian/books", authRequired, roleRequired(["librarian", "admin"]), (req, res) => {
  const data = loadData();
  return res.json(data.books);
});

app.post("/api/librarian/books", authRequired, roleRequired(["librarian", "admin"]), (req, res) => {
  const data = loadData();
  const { title, author, year, cover, description, genre, totalCopies, inventoryNumber, location, category } = req.body;
  if (!validateRequired(title) || !validateRequired(author) || !validateRequired(year) || !validateRequired(genre)) {
    return res.status(400).json({ message: "Заполните обязательные поля" });
  }
  const copies = Number(totalCopies || 1);
  const book = {
    id: crypto.randomUUID(),
    title,
    author,
    year,
    cover: cover || "",
    description: description || "",
    genre,
    totalCopies: copies,
    availableCopies: copies,
    inventoryNumber: inventoryNumber || "",
    location: location || "",
    category: category || "",
    status: "доступна",
    qrCodeDataUrl: "",
    qrPayload: ""
  };
  data.books.push(book);
  saveData(data);
  return res.json(book);
});

app.put("/api/librarian/books/:id", authRequired, roleRequired(["librarian", "admin"]), (req, res) => {
  const data = loadData();
  const book = data.books.find((item) => item.id === req.params.id);
  if (!book) {
    return res.status(404).json({ message: "Книга не найдена" });
  }
  const { title, author, year, cover, description, genre, totalCopies, inventoryNumber, status, location, category } = req.body;
  if (title) book.title = title;
  if (author) book.author = author;
  if (year) book.year = year;
  if (cover !== undefined) book.cover = cover;
  if (description !== undefined) book.description = description;
  if (genre) book.genre = genre;
  if (totalCopies !== undefined) {
    book.totalCopies = Number(totalCopies);
    if (book.availableCopies > book.totalCopies) {
      book.availableCopies = book.totalCopies;
    }
  }
  if (inventoryNumber !== undefined) book.inventoryNumber = inventoryNumber;
  if (location !== undefined) book.location = location;
  if (category !== undefined) book.category = category;
  if (status) book.status = status;
  updateBookAvailability(book);
  saveData(data);
  return res.json(book);
});

app.delete("/api/librarian/books/:id", authRequired, roleRequired(["librarian", "admin"]), (req, res) => {
  const data = loadData();
  const index = data.books.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: "Книга не найдена" });
  }
  data.books.splice(index, 1);
  saveData(data);
  return res.json({ message: "Книга удалена" });
});

app.post("/api/librarian/upload-cover", authRequired, roleRequired(["librarian", "admin"]), upload.single("cover"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Файл не загружен" });
  }
  const url = `/assets/covers/${req.file.filename}`;
  return res.json({ url, filename: req.file.filename });
});

app.post("/api/student/avatar", authRequired, roleRequired(["student"]), uploadAvatar.single("avatar"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Файл не загружен" });
  }
  const data = loadData();
  const user = data.users.find((item) => item.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }
  const url = `/assets/avatars/${req.file.filename}`;
  user.avatarUrl = url;
  saveData(data);
  return res.json({ url });
});

app.post("/api/librarian/books/:id/qr", authRequired, roleRequired(["librarian", "admin"]), async (req, res) => {
  const data = loadData();
  const book = data.books.find((item) => item.id === req.params.id);
  if (!book) {
    return res.status(404).json({ message: "Книга не найдена" });
  }
  const payload = JSON.stringify({
    type: "book",
    bookId: book.id,
    title: book.title,
    author: book.author,
    year: book.year
  });
  const qrCodeDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 300 });
  book.qrCodeDataUrl = qrCodeDataUrl;
  book.qrPayload = payload;
  saveData(data);
  return res.json({ qrCodeDataUrl, title: book.title });
});

app.get("/api/librarian/loans", authRequired, roleRequired(["librarian", "admin"]), (req, res) => {
  const data = loadData();
  const active = data.loans.map((loan) => {
    const student = data.users.find((user) => user.id === loan.studentId) || {};
    const book = data.books.find((item) => item.id === loan.bookId) || {};
    return {
      ...loan,
      status: computeLoanStatus(loan),
      studentName: student.fullName || "",
      studentGroup: student.group || "",
      bookTitle: book.title || ""
    };
  });
  return res.json(active);
});

app.post("/api/librarian/loans/issue", authRequired, roleRequired(["librarian", "admin"]), (req, res) => {
  const data = loadData();
  const { bookId, studentId, dueDate } = req.body;
  const book = data.books.find((item) => item.id === bookId);
  const student = data.users.find((user) => user.id === studentId && user.role === "student");
  if (!book || !student) {
    return res.status(404).json({ message: "Книга или студент не найдены" });
  }
  if (book.availableCopies <= 0) {
    return res.status(400).json({ message: "Книга недоступна" });
  }
  const loan = {
    id: crypto.randomUUID(),
    studentId: student.id,
    bookId: book.id,
    issueDate: new Date().toISOString(),
    dueDate: dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    returnDate: "",
    status: "выдана"
  };
  data.loans.push(loan);
  book.availableCopies = (Number(book.availableCopies) || 0) - 1;
  updateBookAvailability(book);
  saveData(data);
  return res.json(loan);
});

app.post("/api/librarian/loans/return/:id", authRequired, roleRequired(["librarian", "admin"]), (req, res) => {
  const data = loadData();
  const loan = data.loans.find((item) => item.id === req.params.id);
  if (!loan) {
    return res.status(404).json({ message: "Выдача не найдена" });
  }
  if (loan.status === "возвращена") {
    return res.json(loan);
  }
  loan.returnDate = new Date().toISOString();
  loan.status = "возвращена";
  const book = data.books.find((item) => item.id === loan.bookId);
  if (book) {
    book.availableCopies = (Number(book.availableCopies) || 0) + 1;
    updateBookAvailability(book);
  }
  saveData(data);
  return res.json(loan);
});

app.get("/api/student/catalog", authRequired, roleRequired(["student", "admin", "librarian"]), (req, res) => {
  const data = loadData();
  const { search, genre, category, sort, page = 1, limit = 12 } = req.query;
  let items = [...data.books];
  if (search) {
    const target = String(search).toLowerCase();
    items = items.filter((book) => book.title.toLowerCase().includes(target) || book.author.toLowerCase().includes(target));
  }
  if (genre) {
    items = items.filter((book) => book.genre === genre);
  }
  if (category) {
    items = items.filter((book) => book.category === category);
  }
  items.sort((a, b) => {
    const aAvailable = Number(a.availableCopies || 0) > 0 ? 0 : 1;
    const bAvailable = Number(b.availableCopies || 0) > 0 ? 0 : 1;
    if (aAvailable !== bAvailable) return aAvailable - bAvailable;
    if (sort === "category-asc" || sort === "category-desc") {
      const order = sort === "category-asc" ? 1 : -1;
      const categoryCompare = (a.category || "").localeCompare(b.category || "", "ru");
      if (categoryCompare !== 0) return categoryCompare * order;
      return (a.title || "").localeCompare(b.title || "", "ru") * order;
    }
    return (a.title || "").localeCompare(b.title || "", "ru");
  });
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const total = items.length;
  const start = (pageNumber - 1) * limitNumber;
  const paged = items.slice(start, start + limitNumber);
  return res.json({ total, items: paged });
});

app.get("/api/student/books/:id", authRequired, roleRequired(["student", "admin", "librarian"]), (req, res) => {
  const data = loadData();
  const book = data.books.find((item) => item.id === req.params.id);
  if (!book) {
    return res.status(404).json({ message: "Книга не найдена" });
  }
  return res.json(book);
});

app.post("/api/user/fcm-token", authRequired, (req, res) => {
  const data = loadData();
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ message: "Токен не указан" });
  }
  const user = data.users.find((u) => u.id === req.user.id);
  if (user) {
    user.fcmToken = token;
    saveData(data);
  }
  return res.json({ message: "Токен сохранён" });
});

const sendPushToLibrarians = async (data, title, body, extraData = {}) => {
  const librarians = data.users.filter((u) => u.role === "librarian" && u.fcmToken);
  for (const librarian of librarians) {
    try {
      const response = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "key=YOUR_SERVER_KEY"
        },
        body: JSON.stringify({
          to: librarian.fcmToken,
          notification: { title, body },
          data: extraData
        })
      });
      console.log(`Push sent to ${librarian.email}:`, response.status);
    } catch (err) {
      console.warn(`Push error for ${librarian.email}:`, err.message);
    }
  }
};

app.post("/api/student/requests", authRequired, roleRequired(["student"]), async (req, res) => {
  const data = loadData();
  const { bookId } = req.body;
  if (!bookId) {
    return res.status(400).json({ message: "Не указана книга" });
  }
  const book = data.books.find((item) => item.id === bookId);
  if (!book) {
    return res.status(404).json({ message: "Книга не найдена" });
  }
  const existing = data.requests.find(
    (item) => item.bookId === bookId && item.studentId === req.user.id && item.status === "pending"
  );
  if (existing) {
    return res.json({ message: "Запрос уже отправлен" });
  }
  const student = data.users.find((u) => u.id === req.user.id);
  const request = {
    id: crypto.randomUUID(),
    bookId,
    studentId: req.user.id,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  data.requests.push(request);
  saveData(data);

  sendPushToLibrarians(
    data,
    "📚 Новый запрос на книгу",
    `${student?.fullName || "Студент"} хочет взять "${book.title}".\nРасположение: ${book.location || "не указано"}`,
    { bookId, studentId: req.user.id, type: "book_request" }
  );

  return res.json({ message: "Запрос отправлен библиотекарю" });
});

app.get("/api/student/favorites", authRequired, roleRequired(["student"]), (req, res) => {
  const data = loadData();
  const favorites = data.favorites.filter((item) => item.studentId === req.user.id);
  const enriched = favorites.map((fav) => ({
    ...fav,
    book: data.books.find((item) => item.id === fav.bookId) || null
  }));
  return res.json(enriched);
});

app.post("/api/student/favorites", authRequired, roleRequired(["student"]), (req, res) => {
  const data = loadData();
  const { bookId } = req.body;
  if (!bookId) {
    return res.status(400).json({ message: "Нет идентификатора книги" });
  }
  if (data.favorites.some((fav) => fav.studentId === req.user.id && fav.bookId === bookId)) {
    return res.json({ message: "Уже в избранном" });
  }
  data.favorites.push({ id: crypto.randomUUID(), studentId: req.user.id, bookId });
  saveData(data);
  return res.json({ message: "Добавлено в избранное" });
});

app.delete("/api/student/favorites/:bookId", authRequired, roleRequired(["student"]), (req, res) => {
  const data = loadData();
  data.favorites = data.favorites.filter((fav) => !(fav.studentId === req.user.id && fav.bookId === req.params.bookId));
  saveData(data);
  return res.json({ message: "Удалено из избранного" });
});

app.get("/api/student/loans", authRequired, roleRequired(["student"]), (req, res) => {
  const data = loadData();
  const loans = data.loans.filter((loan) => loan.studentId === req.user.id).map((loan) => ({
    ...loan,
    status: computeLoanStatus(loan),
    book: data.books.find((item) => item.id === loan.bookId) || null
  }));
  return res.json(loans);
});

app.get("/api/librarian/requests", authRequired, roleRequired(["librarian", "admin"]), (req, res) => {
  const data = loadData();
  const enriched = data.requests.map((request) => {
    const student = data.users.find((user) => user.id === request.studentId) || {};
    const book = data.books.find((item) => item.id === request.bookId) || {};
    return {
      ...request,
      studentName: student.fullName || "",
      studentGroup: student.group || "",
      studentEmail: student.email || "",
      bookTitle: book.title || "",
      bookAuthor: book.author || "",
      bookLocation: book.location || "",
      availableCopies: book.availableCopies || 0,
      totalCopies: book.totalCopies || 0
    };
  });
  return res.json(enriched);
});

app.post("/api/librarian/requests/:id/resolve", authRequired, roleRequired(["librarian", "admin"]), (req, res) => {
  const data = loadData();
  const request = data.requests.find((item) => item.id === req.params.id);
  if (!request) {
    return res.status(404).json({ message: "Запрос не найден" });
  }
  request.status = req.body.status || "processed";
  request.resolvedAt = new Date().toISOString();
  saveData(data);
  return res.json(request);
});

app.get("/api/student/me", authRequired, roleRequired(["student", "admin", "librarian"]), (req, res) => {
  const data = loadData();
  const user = data.users.find((item) => item.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }
  return res.json(sanitizeUser(user));
});

app.get("/api/student/qr", authRequired, roleRequired(["student"]), async (req, res) => {
  const data = loadData();
  const user = data.users.find((item) => item.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }
  if (!user.qrCodeDataUrl) {
    const payload = JSON.stringify({ type: "student", studentId: user.id });
    user.qrCodeDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 260 });
    saveData(data);
  }
  return res.json({ qrCodeDataUrl: user.qrCodeDataUrl });
});

// Генерация временного QR-кода для выдачи книги (студент+книга)
app.post("/api/student/issue-qr", authRequired, roleRequired(["student"]), async (req, res) => {
  const { bookId } = req.body;
  if (!bookId) {
    return res.status(400).json({ message: "Не указана книга" });
  }

  const data = loadData();
  const user = data.users.find((item) => item.id === req.user.id);
  const book = data.books.find((item) => item.id === bookId);

  if (!user) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }
  if (!book) {
    return res.status(404).json({ message: "Книга не найдена" });
  }
  if ((book.availableCopies || 0) <= 0) {
    return res.status(400).json({ message: "Книга недоступна" });
  }

  // Генерируем уникальный код
  const issueCode = crypto.randomBytes(16).toString("hex");

  // Сохраняем в хранилище
  issueQrCodes.set(issueCode, {
    studentId: user.id,
    studentName: user.fullName,
    studentGroup: user.group || "",
    studentEmail: user.email,
    bookId: book.id,
    bookTitle: book.title,
    bookAuthor: book.author,
    bookLocation: book.location || "",
    createdAt: Date.now()
  });

  // Генерируем QR-код
  const payload = JSON.stringify({ type: "issue", code: issueCode });
  const qrCodeDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 280 });

  return res.json({
    qrCodeDataUrl,
    issueCode,
    expiresIn: QR_TTL / 1000 / 60, // минуты
    book: {
      title: book.title,
      author: book.author
    },
    student: {
      fullName: user.fullName
    }
  });
});

// Расшифровка временного QR-кода для библиотекаря
app.get("/api/librarian/resolve-issue-qr", authRequired, roleRequired(["librarian", "admin"]), (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ message: "Не указан код" });
  }

  const issueData = issueQrCodes.get(code);
  if (!issueData) {
    return res.status(404).json({ message: "QR-код не найден или истёк" });
  }

  // Проверяем срок действия
  const now = Date.now();
  if (now - issueData.createdAt > QR_TTL) {
    issueQrCodes.delete(code);
    return res.status(410).json({ message: "QR-код истёк" });
  }

  // Возвращаем данные
  return res.json({
    type: "issue",
    studentId: issueData.studentId,
    studentName: issueData.studentName,
    studentGroup: issueData.studentGroup,
    studentEmail: issueData.studentEmail,
    bookId: issueData.bookId,
    bookTitle: issueData.bookTitle,
    bookAuthor: issueData.bookAuthor,
    bookLocation: issueData.bookLocation,
    expiresAt: new Date(issueData.createdAt + QR_TTL).toISOString()
  });
});

app.get("/api/librarian/students", authRequired, roleRequired(["librarian", "admin"]), (req, res) => {
  const data = loadData();
  const { search } = req.query;
  let students = data.users.filter((user) => user.role === "student");
  if (search) {
    const target = String(search).toLowerCase();
    students = students.filter((user) => user.fullName.toLowerCase().includes(target) || user.email.toLowerCase().includes(target) || (user.group || "").toLowerCase().includes(target));
  }
  return res.json(students.map(sanitizeUser));
});

app.get("/api/qr/resolve", authRequired, roleRequired(["librarian", "admin"]), (req, res) => {
  const { payload } = req.query;
  if (!payload) {
    return res.status(400).json({ message: "Нет данных QR" });
  }
  try {
    const parsed = JSON.parse(payload);
    return res.json(parsed);
  } catch (error) {
    return res.status(400).json({ message: "QR не распознан" });
  }
});

app.get("/api/health", (req, res) => {
  return res.json({ status: "ok" });
});

ensureAdmin()
  .then(async () => {
    const port = process.env.PORT || 10216;
    const { networkInterfaces } = await import("os");
    const nets = networkInterfaces();
    let localIP = "127.0.0.1";
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal) {
          localIP = net.address;
          break;
        }
      }
      if (localIP !== "127.0.0.1") break;
    }
    logBanner();
    app.listen(port, "0.0.0.0", () => {
      logInfo(`Server listening on http://localhost:${port}`, "libro");
      logInfo(`Network access: http://${localIP}:${port}`, "libro");
    });
  })
  .catch((error) => {
    logError("Failed to start server", error);
    process.exit(1);
  });
