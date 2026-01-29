const state = {
  accessToken: localStorage.getItem("accessToken") || "",
  refreshToken: localStorage.getItem("refreshToken") || "",
  user: null,
  catalogPage: 1,
  catalogTotal: 0,
  catalogLimit: 8,
  catalogSearch: "",
  catalogGenre: "",
  genres: [],
  bookScan: null,
  studentScan: null,
  currentBookDetail: null
};

const elements = {
  views: document.querySelectorAll("[data-section]"),
  navItems: document.querySelectorAll(".nav-item"),
  toast: document.querySelector("[data-toast]"),
  menu: document.querySelector("[data-menu]"),
  overlay: document.querySelector("[data-overlay]"),
  authModal: document.querySelector("[data-modal='auth']"),
  burgerBtn: document.querySelector(".burger-btn"),
  headerLoginBtn: document.querySelector(".header-login-btn")
};

const initTheme = () => {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.body.classList.remove("theme-light");
    document.body.classList.add("theme-dark");
  } else {
    document.body.classList.remove("theme-dark");
    document.body.classList.add("theme-light");
  }
  updateThemeIcon();
};

const updateThemeIcon = () => {
  const icon = document.querySelector("[data-icon='theme']");
  if (icon) {
    icon.className = document.body.classList.contains("theme-dark") ? "fas fa-sun" : "fas fa-moon";
  }
};

const toast = (message, type = "info") => {
  elements.toast.textContent = message;
  elements.toast.className = "toast show " + type;
  setTimeout(() => elements.toast.classList.remove("show"), 3000);
};

const setActiveView = (name) => {
  elements.views.forEach((view) => {
    view.classList.toggle("active", view.dataset.section === name);
  });
  elements.navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.view === name);
  });
};

const closeMenu = () => {
  elements.menu.classList.add("hidden");
  elements.overlay.classList.add("hidden");
  document.body.style.overflow = "";
};

const openMenu = () => {
  elements.menu.classList.remove("hidden");
  elements.overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
};

const setAuthState = (user) => {
  state.user = user;
  const loginForm = document.querySelector("[data-form='login']");
  const registerForm = document.querySelector("[data-form='register']");
  
  if (!user) {
    setActiveView("landing");
    elements.menu.classList.add("hidden");
    elements.overlay.classList.add("hidden");
    elements.burgerBtn.classList.add("hidden");
    elements.headerLoginBtn.classList.remove("hidden");
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    return;
  }
  
  elements.authModal.classList.add("hidden");
  elements.headerLoginBtn.classList.add("hidden");
  elements.burgerBtn.classList.remove("hidden");
  elements.menu.classList.remove("hidden");
  
  const navUser = document.querySelector("[data-slot='nav-user']");
  if (navUser) {
    const roleNames = { student: "Студент", librarian: "Библиотекарь", admin: "Администратор" };
    navUser.innerHTML = `
      <div class="nav-user-name">${user.fullName}</div>
      <div class="nav-user-role">${roleNames[user.role] || user.role}</div>
    `;
  }
  
  if (user.role === "student") {
    setActiveView("catalog");
    loadCatalog();
    loadStudentLoans();
    loadFavorites();
    loadStudentQr();
  }
  if (user.role === "librarian") {
    setActiveView("librarian-books");
    loadBooks();
    loadLibrarianLoans();
    initScanner();
  }
  if (user.role === "admin") {
    setActiveView("admin-users");
    loadUsers();
    loadAdminStats();
    loadAdminLoans();
  }
  updateNavVisibility();
  closeMenu();
};

const updateNavVisibility = () => {
  const role = state.user ? state.user.role : "";
  document.querySelectorAll(".nav-item").forEach((item) => {
    const view = item.dataset.view;
    if (!view) return;
    const studentViews = ["catalog", "student-loans", "favorites", "student-qr"];
    const librarianViews = ["librarian-books", "librarian-issue", "librarian-loans"];
    const adminViews = ["admin-users", "admin-stats", "admin-loans"];
    const visible =
      (role === "student" && studentViews.includes(view)) ||
      (role === "librarian" && librarianViews.includes(view)) ||
      (role === "admin" && adminViews.includes(view));
    item.style.display = visible ? "flex" : "none";
  });
};

const queueKey = "vtkQueue";

const loadQueue = () => JSON.parse(localStorage.getItem(queueKey) || "[]");

const saveQueue = (items) => localStorage.setItem(queueKey, JSON.stringify(items));

const enqueueAction = (action) => {
  const queue = loadQueue();
  queue.push(action);
  saveQueue(queue);
  toast("Действие сохранено и будет отправлено при подключении");
};

const processQueue = async () => {
  const queue = loadQueue();
  if (!queue.length) return;
  const remaining = [];
  for (const action of queue) {
    try {
      await fetchWithAuth(action.url, action.options, true);
    } catch (error) {
      remaining.push(action);
    }
  }
  saveQueue(remaining);
};

const fetchWithAuth = async (url, options = {}, skipQueue) => {
  const init = { ...options };
  init.headers = init.headers || {};
  if (state.accessToken) {
    init.headers.Authorization = `Bearer ${state.accessToken}`;
  }
  if (!navigator.onLine && init.method && init.method !== "GET" && !skipQueue) {
    enqueueAction({ url, options: init });
    return { offline: true };
  }
  const response = await fetch(url, init);
  if (response.status === 401 && state.refreshToken && !skipQueue) {
    const refreshed = await refreshAccess();
    if (refreshed) {
      init.headers.Authorization = `Bearer ${state.accessToken}`;
      return fetchWithAuth(url, init, true);
    }
  }
  return response;
};

const refreshAccess = async () => {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: state.refreshToken })
  });
  if (!response.ok) {
    return false;
  }
  const data = await response.json();
  state.accessToken = data.accessToken;
  localStorage.setItem("accessToken", data.accessToken);
  return true;
};

const loadCurrentUser = async () => {
  if (!state.accessToken) {
    setAuthState(null);
    return;
  }
  const response = await fetchWithAuth("/api/student/me");
  if (!response.ok) {
    setAuthState(null);
    return;
  }
  const user = await response.json();
  setAuthState(user);
};

const renderCatalog = (items) => {
  const container = document.querySelector("[data-list='catalog']");
  container.innerHTML = "";
  items.forEach((book) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${book.cover || "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=400&q=80"}" alt="${book.title}">
      <div class="card-title">${book.title}</div>
      <div class="card-meta">${book.author} · ${book.genre}</div>
      <div class="badge">${book.status}</div>
      <div class="card-actions">
        <button class="secondary-button" data-action="details" data-id="${book.id}">Подробнее</button>
        <button class="primary-button" data-action="favorite" data-id="${book.id}">В избранное</button>
      </div>
    `;
    container.appendChild(card);
  });
};

const renderStudentLoans = (items) => {
  const container = document.querySelector("[data-list='student-loans']");
  container.innerHTML = "";
  if (!items.length) {
    container.textContent = "Пока нет выданных книг";
    return;
  }
  items.forEach((loan) => {
    const item = document.createElement("div");
    item.className = "card";
    item.innerHTML = `
      <div class="card-title">${loan.book ? loan.book.title : ""}</div>
      <div class="card-meta">Срок возврата до ${new Date(loan.dueDate).toLocaleDateString()}</div>
      <div class="badge">${loan.status}</div>
    `;
    container.appendChild(item);
  });
};

const renderFavorites = (items) => {
  const container = document.querySelector("[data-list='favorites']");
  container.innerHTML = "";
  if (!items.length) {
    container.textContent = "Нет избранных книг";
    return;
  }
  items.forEach((fav) => {
    if (!fav.book) return;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${fav.book.cover || "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=400&q=80"}" alt="${fav.book.title}">
      <div class="card-title">${fav.book.title}</div>
      <div class="card-meta">${fav.book.author}</div>
      <div class="card-actions">
        <button class="secondary-button" data-action="remove-favorite" data-id="${fav.book.id}">Удалить</button>
      </div>
    `;
    container.appendChild(card);
  });
};

const renderBooksTable = (items) => {
  const container = document.querySelector("[data-list='books']");
  container.innerHTML = "";
  items.forEach((book) => {
    const row = document.createElement("div");
    row.className = "table-row";
    row.innerHTML = `
      <div>${book.title}</div>
      <div>${book.author}</div>
      <div>${book.genre}</div>
      <div>${book.availableCopies} из ${book.totalCopies}</div>
      <div class="table-actions">
        <button class="secondary-button" data-action="edit-book" data-id="${book.id}">Редактировать</button>
        <button class="secondary-button" data-action="qr-book" data-id="${book.id}">QR</button>
        <button class="secondary-button" data-action="delete-book" data-id="${book.id}">Удалить</button>
      </div>
    `;
    container.appendChild(row);
  });
};

const renderLibrarianLoans = (items) => {
  const container = document.querySelector("[data-list='librarian-loans']");
  container.innerHTML = "";
  items.forEach((loan) => {
    const row = document.createElement("div");
    row.className = "table-row";
    row.innerHTML = `
      <div>${loan.bookTitle}</div>
      <div>${loan.studentName}</div>
      <div>${loan.status}</div>
      <div>${new Date(loan.dueDate).toLocaleDateString()}</div>
      <div class="table-actions">
        <button class="secondary-button" data-action="return-loan" data-id="${loan.id}">Отметить возврат</button>
      </div>
    `;
    container.appendChild(row);
  });
};

const renderUsers = (items) => {
  const container = document.querySelector("[data-list='users']");
  container.innerHTML = "";
  const roleNames = { student: "Студент", librarian: "Библиотекарь", admin: "Администратор" };
  const roleIcons = { student: "fa-user-graduate", librarian: "fa-book-reader", admin: "fa-user-shield" };
  items.forEach((user) => {
    const card = document.createElement("div");
    card.className = "user-card";
    card.innerHTML = `
      <div class="user-card-main">
        <div class="user-avatar">
          <i class="fas ${roleIcons[user.role] || 'fa-user'}"></i>
        </div>
        <div class="user-info">
          <div class="user-name">${user.fullName}</div>
          <div class="user-email">${user.email}</div>
          <div class="user-meta">
            <span class="user-role role-${user.role}">${roleNames[user.role] || user.role}</span>
            ${user.group ? `<span class="user-group"><i class="fas fa-users"></i> ${user.group}</span>` : ""}
            <span class="user-status ${user.blocked ? 'status-blocked' : 'status-active'}">
              <i class="fas ${user.blocked ? 'fa-ban' : 'fa-check-circle'}"></i>
              ${user.blocked ? "Заблокирован" : "Активен"}
            </span>
          </div>
        </div>
      </div>
      <div class="user-card-actions">
        <button class="action-btn ${user.blocked ? 'btn-success' : 'btn-warning'}" data-action="toggle-block" data-id="${user.id}" data-blocked="${user.blocked}" title="${user.blocked ? 'Разблокировать' : 'Заблокировать'}">
          <i class="fas ${user.blocked ? 'fa-unlock' : 'fa-lock'}"></i>
          <span>${user.blocked ? "Разблокировать" : "Заблокировать"}</span>
        </button>
        <button class="action-btn btn-primary" data-action="open-role-change" data-id="${user.id}" data-name="${user.fullName}" data-role="${user.role}" title="Сменить роль">
          <i class="fas fa-user-tag"></i>
          <span>Роль</span>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
};

const renderAdminLoans = (items) => {
  const container = document.querySelector("[data-list='admin-loans']");
  container.innerHTML = "";
  items.forEach((loan) => {
    const row = document.createElement("div");
    row.className = "table-row";
    row.innerHTML = `
      <div>${loan.bookTitle}</div>
      <div>${loan.studentName}</div>
      <div>${loan.status}</div>
      <div>${new Date(loan.issueDate).toLocaleDateString()}</div>
      <div>${loan.returnDate ? new Date(loan.returnDate).toLocaleDateString() : "Не возвращена"}</div>
    `;
    container.appendChild(row);
  });
};

const renderStats = (data) => {
  const stats = document.querySelector("[data-list='stats']");
  const totalUsers = (data.usersByRole?.student || 0) + (data.usersByRole?.librarian || 0) + (data.usersByRole?.admin || 0);
  const activeLoans = data.activeLoans || 0;
  
  stats.innerHTML = `
    <div class="stat-card stat-books">
      <div class="stat-icon"><i class="fas fa-book"></i></div>
      <div class="stat-content">
        <div class="stat-value">${data.totalBooks}</div>
        <div class="stat-label">Книг в фонде</div>
      </div>
    </div>
    <div class="stat-card stat-users">
      <div class="stat-icon"><i class="fas fa-users"></i></div>
      <div class="stat-content">
        <div class="stat-value">${totalUsers}</div>
        <div class="stat-label">Пользователей</div>
      </div>
    </div>
    <div class="stat-card stat-today">
      <div class="stat-icon"><i class="fas fa-calendar-day"></i></div>
      <div class="stat-content">
        <div class="stat-value">${data.issuedToday}</div>
        <div class="stat-label">Выдано сегодня</div>
      </div>
    </div>
    <div class="stat-card stat-week">
      <div class="stat-icon"><i class="fas fa-calendar-week"></i></div>
      <div class="stat-content">
        <div class="stat-value">${data.issuedWeek}</div>
        <div class="stat-label">За неделю</div>
      </div>
    </div>
    <div class="stat-card stat-active">
      <div class="stat-icon"><i class="fas fa-hand-holding"></i></div>
      <div class="stat-content">
        <div class="stat-value">${activeLoans}</div>
        <div class="stat-label">На руках</div>
      </div>
    </div>
    <div class="stat-card stat-overdue ${data.overdue > 0 ? 'stat-warning' : ''}">
      <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
      <div class="stat-content">
        <div class="stat-value">${data.overdue}</div>
        <div class="stat-label">Просрочено</div>
      </div>
    </div>
  `;

  const popularChart = document.querySelector("[data-list='popular']");
  popularChart.innerHTML = "";
  if (data.popularBooks && data.popularBooks.length) {
    const max = Math.max(1, ...data.popularBooks.map((item) => item.count));
    data.popularBooks.forEach((item, i) => {
      const bar = document.createElement("div");
      bar.className = "chart-bar";
      bar.innerHTML = `
        <div class="bar-label">
          <span class="bar-rank">${i + 1}</span>
          <span class="bar-title">${item.title}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${(item.count / max) * 100}%">
            <span class="bar-value">${item.count}</span>
          </div>
        </div>
      `;
      popularChart.appendChild(bar);
    });
  } else {
    popularChart.innerHTML = '<div class="no-data">Нет данных о выдачах</div>';
  }

  const weeklyChart = document.querySelector("[data-list='weekly']");
  if (weeklyChart) {
    weeklyChart.innerHTML = "";
    const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const weekData = data.weeklyIssues || [0, 0, 0, 0, 0, 0, 0];
    const maxWeek = Math.max(1, ...weekData);
    weeklyChart.innerHTML = `
      <div class="week-bars">
        ${weekData.map((val, i) => `
          <div class="week-bar">
            <div class="week-bar-fill" style="height:${(val / maxWeek) * 100}%">
              <span class="week-bar-value">${val}</span>
            </div>
            <span class="week-bar-label">${days[i]}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  const usersPie = document.querySelector("[data-list='users-pie']");
  if (usersPie && data.usersByRole) {
    const roles = data.usersByRole;
    const total = (roles.student || 0) + (roles.librarian || 0) + (roles.admin || 0);
    usersPie.innerHTML = `
      <div class="pie-legend">
        <div class="legend-item">
          <span class="legend-color student"></span>
          <span class="legend-label">Студенты</span>
          <span class="legend-value">${roles.student || 0}</span>
        </div>
        <div class="legend-item">
          <span class="legend-color librarian"></span>
          <span class="legend-label">Библиотекари</span>
          <span class="legend-value">${roles.librarian || 0}</span>
        </div>
        <div class="legend-item">
          <span class="legend-color admin"></span>
          <span class="legend-label">Администраторы</span>
          <span class="legend-value">${roles.admin || 0}</span>
        </div>
      </div>
      <div class="pie-total">
        <div class="pie-total-value">${total}</div>
        <div class="pie-total-label">всего</div>
      </div>
    `;
  }

  const genresChart = document.querySelector("[data-list='genres']");
  if (genresChart && data.booksByGenre) {
    genresChart.innerHTML = "";
    const genres = data.booksByGenre;
    const maxGenre = Math.max(1, ...Object.values(genres));
    Object.entries(genres).slice(0, 6).forEach(([genre, count]) => {
      const bar = document.createElement("div");
      bar.className = "chart-bar";
      bar.innerHTML = `
        <div class="bar-label">
          <span class="bar-title">${genre}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill genre-fill" style="width:${(count / maxGenre) * 100}%">
            <span class="bar-value">${count}</span>
          </div>
        </div>
      `;
      genresChart.appendChild(bar);
    });
    if (!Object.keys(genres).length) {
      genresChart.innerHTML = '<div class="no-data">Нет данных о жанрах</div>';
    }
  }
};

const loadCatalog = async () => {
  const params = new URLSearchParams({
    page: state.catalogPage,
    limit: state.catalogLimit,
    search: state.catalogSearch,
    genre: state.catalogGenre
  });
  const response = await fetchWithAuth(`/api/student/catalog?${params.toString()}`);
  if (!response.ok) return;
  const data = await response.json();
  state.catalogTotal = data.total;
  renderCatalog(data.items);
  document.querySelector("[data-text='catalog-page']").textContent = String(state.catalogPage);
  if (!state.genres.length) {
    const genres = new Set();
    data.items.forEach((item) => genres.add(item.genre));
    state.genres = [...genres];
    const select = document.querySelector("[data-input='catalog-genre']");
    state.genres.forEach((genre) => {
      const option = document.createElement("option");
      option.value = genre;
      option.textContent = genre;
      select.appendChild(option);
    });
  }
};

const loadStudentLoans = async () => {
  const response = await fetchWithAuth("/api/student/loans");
  if (!response.ok) return;
  const data = await response.json();
  renderStudentLoans(data);
};

const loadFavorites = async () => {
  const response = await fetchWithAuth("/api/student/favorites");
  if (!response.ok) return;
  const data = await response.json();
  renderFavorites(data);
};

const loadStudentQr = async () => {
  const response = await fetchWithAuth("/api/student/qr");
  if (!response.ok) return;
  const data = await response.json();
  const slot = document.querySelector("[data-slot='student-qr']");
  slot.innerHTML = `<img src="${data.qrCodeDataUrl}" alt="QR">`;
};

const loadBooks = async () => {
  const response = await fetchWithAuth("/api/librarian/books");
  if (!response.ok) return;
  const data = await response.json();
  renderBooksTable(data);
};

const loadLibrarianLoans = async () => {
  const response = await fetchWithAuth("/api/librarian/loans");
  if (!response.ok) return;
  const data = await response.json();
  renderLibrarianLoans(data);
};

const loadUsers = async () => {
  const role = document.querySelector("[data-input='user-role']").value;
  const search = document.querySelector("[data-input='user-search']").value;
  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (search) params.set("search", search);
  const response = await fetchWithAuth(`/api/admin/users?${params.toString()}`);
  if (!response.ok) return;
  const data = await response.json();
  renderUsers(data);
};

const loadAdminStats = async () => {
  const response = await fetchWithAuth("/api/admin/stats");
  if (!response.ok) return;
  const data = await response.json();
  renderStats(data);
};

const loadAdminLoans = async () => {
  const response = await fetchWithAuth("/api/admin/loans");
  if (!response.ok) return;
  const data = await response.json();
  renderAdminLoans(data);
};

const openModal = (name) => {
  document.querySelector(`[data-modal='${name}']`).classList.remove("hidden");
};

const closeModal = (name) => {
  document.querySelector(`[data-modal='${name}']`).classList.add("hidden");
};

const beepSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 1800;
    oscillator.type = "sine";
    gain.gain.value = 0.3;
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.15);
  } catch (e) {}
};

let scannerStream = null;
let scannerActive = false;

const stopScanner = () => {
  if (scannerStream) {
    scannerStream.getTracks().forEach(track => track.stop());
    scannerStream = null;
  }
  scannerActive = false;
  const video = document.querySelector("[data-video='scanner']");
  if (video) video.srcObject = null;
  const btn = document.querySelector("[data-action='start-scanner']");
  if (btn) {
    btn.innerHTML = '<i class="fas fa-camera"></i><span>Запустить сканер</span>';
  }
};

const startScanner = async () => {
  const video = document.querySelector("[data-video='scanner']");
  const statusEl = document.querySelector("[data-text='issue-status']");
  const btn = document.querySelector("[data-action='start-scanner']");
  
  if (scannerActive) {
    stopScanner();
    return;
  }

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
    });
    video.srcObject = scannerStream;
    scannerActive = true;
    btn.innerHTML = '<i class="fas fa-stop"></i><span>Остановить сканер</span>';
    statusEl.textContent = "Наведите камеру на QR-код...";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const scan = () => {
      if (!scannerActive) return;
      if (video.readyState < 2) {
        requestAnimationFrame(scan);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR ? window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" }) : null;

      if (code && code.data) {
        try {
          const parsed = JSON.parse(code.data);
          if (parsed.type === "book" && !state.bookScan) {
            state.bookScan = parsed.bookId;
            document.querySelector("[data-text='book-scan']").textContent = parsed.title || "Книга распознана";
            beepSound();
            toast("Книга отсканирована", "success");
          } else if (parsed.type === "student" && !state.studentScan) {
            state.studentScan = parsed.studentId;
            document.querySelector("[data-text='student-scan']").textContent = parsed.fullName || "Студент распознан";
            beepSound();
            toast("Студент отсканирован", "success");
          }
          if (state.bookScan && state.studentScan) {
            statusEl.textContent = "Готово к выдаче!";
          }
        } catch (e) {}
      }

      requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  } catch (error) {
    statusEl.textContent = "Нет доступа к камере. Разрешите доступ в настройках браузера.";
  }
};

const initScanner = () => {
  state.bookScan = null;
  state.studentScan = null;
};

const handlers = {
  async login(form) {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const submitBtn = form.querySelector(".submit-btn");
    if (submitBtn) submitBtn.disabled = true;
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = await response.json();
        toast(error.message || "Ошибка входа", "error");
        return;
      }
      const data = await response.json();
      state.accessToken = data.accessToken;
      state.refreshToken = data.refreshToken;
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      toast("Добро пожаловать, " + data.user.fullName + "!", "success");
      setAuthState(data.user);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  },
  async register(form) {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const submitBtn = form.querySelector(".submit-btn");
    if (submitBtn) submitBtn.disabled = true;
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        toast(data.message || "Ошибка регистрации", "error");
        return;
      }
      toast("Регистрация успешна! Войдите в систему", "success");
      document.querySelector("[data-form='register']").classList.add("hidden");
      document.querySelector("[data-form='login']").classList.remove("hidden");
      document.querySelector("[data-text='auth-title']").textContent = "Вход в систему";
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }
};

document.addEventListener("click", async (event) => {
  const navItem = event.target.closest("[data-view]");
  if (navItem && state.user) {
    const view = navItem.dataset.view;
    setActiveView(view);
    closeMenu();
    return;
  }

  const action = event.target.closest("[data-action]");
  if (!action) return;
  const name = action.dataset.action;
  if (name === "toggle-theme") {
    document.body.classList.toggle("theme-dark");
    document.body.classList.toggle("theme-light");
    localStorage.setItem("theme", document.body.classList.contains("theme-dark") ? "dark" : "light");
    updateThemeIcon();
  }
  if (name === "toggle-menu") {
    if (elements.menu.classList.contains("hidden")) {
      openMenu();
    } else {
      closeMenu();
    }
  }
  if (name === "close-menu") {
    closeMenu();
  }
  if (name === "open-auth") {
    elements.authModal.classList.remove("hidden");
    document.querySelector("[data-form='login']").classList.remove("hidden");
    document.querySelector("[data-form='register']").classList.add("hidden");
    document.querySelector("[data-text='auth-title']").textContent = "Вход в систему";
  }
  if (name === "open-register") {
    elements.authModal.classList.remove("hidden");
    document.querySelector("[data-form='login']").classList.add("hidden");
    document.querySelector("[data-form='register']").classList.remove("hidden");
    document.querySelector("[data-text='auth-title']").textContent = "Регистрация";
  }
  if (name === "close-auth") {
    elements.authModal.classList.add("hidden");
  }
  if (name === "logout") {
    state.accessToken = "";
    state.refreshToken = "";
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setAuthState(null);
    toast("Вы вышли из системы", "info");
  }
  if (name === "show-register") {
    document.querySelector("[data-form='login']").classList.add("hidden");
    document.querySelector("[data-form='register']").classList.remove("hidden");
    document.querySelector("[data-text='auth-title']").textContent = "Регистрация";
  }
  if (name === "show-login") {
    document.querySelector("[data-form='register']").classList.add("hidden");
    document.querySelector("[data-form='login']").classList.remove("hidden");
    document.querySelector("[data-text='auth-title']").textContent = "Вход в систему";
  }
  if (name === "catalog-refresh") {
    state.catalogPage = 1;
    loadCatalog();
  }
  if (name === "catalog-next") {
    if (state.catalogPage * state.catalogLimit < state.catalogTotal) {
      state.catalogPage += 1;
      loadCatalog();
    }
  }
  if (name === "catalog-prev") {
    if (state.catalogPage > 1) {
      state.catalogPage -= 1;
      loadCatalog();
    }
  }
  if (name === "favorite") {
    const bookId = action.dataset.id;
    const response = await fetchWithAuth("/api/student/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId })
    });
    if (response.offline) return;
    const data = await response.json();
    toast(data.message || "Добавлено в избранное");
    loadFavorites();
  }
  if (name === "remove-favorite") {
    const bookId = action.dataset.id;
    const response = await fetchWithAuth(`/api/student/favorites/${bookId}`, { method: "DELETE" });
    if (response.offline) return;
    const data = await response.json();
    toast(data.message || "Удалено");
    loadFavorites();
  }
  if (name === "details") {
    const bookId = action.dataset.id;
    const response = await fetchWithAuth(`/api/student/books/${bookId}`);
    if (!response.ok) return;
    const book = await response.json();
    state.currentBookDetail = book;
    
    document.querySelector("[data-text='book-detail-name']").textContent = book.title;
    document.querySelector("[data-text='book-detail-author']").textContent = book.author;
    document.querySelector("[data-text='book-detail-year']").textContent = book.year || "—";
    document.querySelector("[data-text='book-detail-genre']").textContent = book.genre || "—";
    document.querySelector("[data-text='book-detail-category']").textContent = book.category || "Не указана";
    document.querySelector("[data-text='book-detail-available']").textContent = book.availableCopies || 0;
    document.querySelector("[data-text='book-detail-total']").textContent = book.totalCopies || 1;
    document.querySelector("[data-text='book-detail-inv']").textContent = book.inventoryNumber || "—";
    document.querySelector("[data-text='book-detail-desc']").textContent = book.description || "Описание отсутствует";
    document.querySelector("[data-text='book-detail-location']").textContent = book.location || "Расположение не указано";
    
    const coverSlot = document.querySelector("[data-slot='book-detail-cover']");
    if (book.cover) {
      coverSlot.innerHTML = `<img src="${book.cover}" alt="${book.title}">`;
    } else {
      coverSlot.innerHTML = '<i class="fas fa-book"></i>';
    }
    
    const availIndicator = document.querySelector(".availability-indicator");
    if ((book.availableCopies || 0) > 0) {
      availIndicator.className = "availability-indicator available";
      availIndicator.querySelector("i").className = "fas fa-check-circle";
    } else {
      availIndicator.className = "availability-indicator unavailable";
      availIndicator.querySelector("i").className = "fas fa-times-circle";
    }
    
    const studentShelf = document.querySelector("[data-slot='student-bookshelf']");
    let row = 1, shelf = 1;
    if (book.location) {
      const rowMatch = book.location.match(/ряд\s*(\d+)/i);
      const shelfMatch = book.location.match(/полка\s*(\d+)/i);
      if (rowMatch) row = parseInt(rowMatch[1]);
      if (shelfMatch) shelf = parseInt(shelfMatch[1]);
    }
    let shelfHtml = '';
    for (let r = 1; r <= 10; r++) {
      for (let s = 1; s <= 10; s++) {
        const isHighlight = (r === row && s === shelf) ? 'highlight' : '';
        shelfHtml += `<div class="bookshelf-cell ${isHighlight}"></div>`;
      }
    }
    studentShelf.innerHTML = shelfHtml;
    
    const qrSlot = document.querySelector("[data-slot='book-qr-image']");
    if (book.qrCodeDataUrl) {
      qrSlot.innerHTML = `<img src="${book.qrCodeDataUrl}" alt="QR">`;
    } else {
      qrSlot.innerHTML = '<span style="color:#94a3b8;font-size:13px">QR-код не сгенерирован</span>';
    }
    
    openModal("book-detail");
  }
  if (name === "close-book-detail") {
    closeModal("book-detail");
  }
  if (name === "toggle-favorite-detail") {
    if (!state.currentBookDetail) return;
    const response = await fetchWithAuth("/api/student/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: state.currentBookDetail.id })
    });
    if (response.offline) return;
    const data = await response.json();
    toast(data.message || "Добавлено в избранное", "success");
  }
  if (name === "open-book-form") {
    document.querySelector("[data-form='book']").reset();
    document.querySelector("[data-input='book-id']").value = "";
    document.querySelector("[data-input='cover-hidden']").value = "";
    document.querySelector("[data-input='location-row']").value = 1;
    document.querySelector("[data-input='location-shelf']").value = 1;
    pendingCoverFile = null;
    setCoverPreview(null);
    updateLocationPreview();
    openModal("book-form");
  }
  if (name === "close-book-form") {
    closeModal("book-form");
  }
  if (name === "edit-book") {
    const bookId = action.dataset.id;
    const response = await fetchWithAuth("/api/librarian/books");
    const books = await response.json();
    const book = books.find((item) => item.id === bookId);
    if (!book) return;
    const form = document.querySelector("[data-form='book']");
    document.querySelector("[data-input='book-id']").value = book.id;
    form.title.value = book.title;
    form.author.value = book.author;
    form.year.value = book.year;
    form.genre.value = book.genre;
    form.description.value = book.description || "";
    form.totalCopies.value = book.totalCopies;
    form.inventoryNumber.value = book.inventoryNumber || "";
    form.category.value = book.category || "";
    document.querySelector("[data-input='cover-hidden']").value = book.cover || "";
    
    let row = 1, shelf = 1;
    if (book.location) {
      const rowMatch = book.location.match(/ряд\s*(\d+)/i);
      const shelfMatch = book.location.match(/полка\s*(\d+)/i);
      if (rowMatch) row = parseInt(rowMatch[1]);
      if (shelfMatch) shelf = parseInt(shelfMatch[1]);
    }
    document.querySelector("[data-input='location-row']").value = row;
    document.querySelector("[data-input='location-shelf']").value = shelf;
    updateLocationPreview();
    
    if (book.cover) {
      setCoverPreview(book.cover);
    } else {
      setCoverPreview(null);
    }
    pendingCoverFile = null;
    openModal("book-form");
  }
  if (name === "delete-book") {
    const bookId = action.dataset.id;
    const response = await fetchWithAuth(`/api/librarian/books/${bookId}`, { method: "DELETE" });
    if (response.offline) return;
    const data = await response.json();
    toast(data.message || "Книга удалена");
    loadBooks();
  }
  if (name === "qr-book") {
    const bookId = action.dataset.id;
    const response = await fetchWithAuth(`/api/librarian/books/${bookId}/qr`, { method: "POST" });
    if (!response.ok) return;
    const data = await response.json();
    document.querySelector("[data-slot='book-qr']").innerHTML = `<img src="${data.qrCodeDataUrl}" alt="QR">`;
    openModal("qr-viewer");
  }
  if (name === "close-qr") {
    closeModal("qr-viewer");
  }
  if (name === "print-qr") {
    window.print();
  }
  if (name === "browse-cover") {
    document.querySelector("[data-input='cover-file']").click();
  }
  if (name === "remove-cover") {
    pendingCoverFile = null;
    document.querySelector("[data-input='cover-hidden']").value = "";
    setCoverPreview(null);
  }
  if (name === "start-scanner") {
    startScanner();
  }
  if (name === "clear-book-scan") {
    state.bookScan = null;
    document.querySelector("[data-text='book-scan']").textContent = "Не отсканирована";
  }
  if (name === "clear-student-scan") {
    state.studentScan = null;
    document.querySelector("[data-text='student-scan']").textContent = "Не отсканирован";
  }
  if (name === "issue-book") {
    if (!state.bookScan || !state.studentScan) {
      toast("Сначала отсканируйте книгу и студента", "error");
      return;
    }
    const due = document.querySelector("[data-input='due-date']").value;
    if (!due) {
      toast("Укажите срок возврата", "error");
      return;
    }
    const response = await fetchWithAuth("/api/librarian/loans/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: state.bookScan, studentId: state.studentScan, dueDate: due })
    });
    if (response.offline) return;
    const data = await response.json();
    if (response.ok) {
      toast("Выдача оформлена!", "success");
      beepSound();
      document.querySelector("[data-text='issue-status']").textContent = "Выдача оформлена успешно!";
      state.bookScan = null;
      state.studentScan = null;
      document.querySelector("[data-text='book-scan']").textContent = "Не отсканирована";
      document.querySelector("[data-text='student-scan']").textContent = "Не отсканирован";
      loadBooks();
      loadLibrarianLoans();
    } else {
      toast(data.message || "Ошибка выдачи", "error");
      document.querySelector("[data-text='issue-status']").textContent = data.message || "Ошибка";
    }
  }
  if (name === "return-loan") {
    const id = action.dataset.id;
    const response = await fetchWithAuth(`/api/librarian/loans/return/${id}`, { method: "POST" });
    if (response.offline) return;
    loadLibrarianLoans();
  }
  if (name === "open-user-form") {
    openModal("user-form");
  }
  if (name === "close-user-form") {
    closeModal("user-form");
    document.querySelector("[data-form='user']").reset();
  }
  if (name === "users-refresh") {
    loadUsers();
  }
  if (name === "refresh-stats") {
    loadAdminStats();
  }
  if (name === "toggle-block") {
    const id = action.dataset.id;
    const blocked = action.dataset.blocked === "true";
    await fetchWithAuth(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: !blocked })
    });
    toast(blocked ? "Пользователь разблокирован" : "Пользователь заблокирован", "success");
    loadUsers();
  }
  if (name === "open-role-change") {
    const id = action.dataset.id;
    const userName = action.dataset.name;
    const currentRole = action.dataset.role;
    state.roleChangeUserId = id;
    document.querySelector("[data-text='role-user-name']").textContent = userName;
    document.querySelector("[data-input='new-role']").value = currentRole;
    openModal("role-form");
  }
  if (name === "close-role-form") {
    closeModal("role-form");
  }
  if (name === "confirm-role-change") {
    const id = state.roleChangeUserId;
    const role = document.querySelector("[data-input='new-role']").value;
    await fetchWithAuth(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });
    toast("Роль пользователя изменена", "success");
    closeModal("role-form");
    loadUsers();
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("form");
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === "login") {
    handlers.login(form);
  }
  if (form.dataset.form === "register") {
    handlers.register(form);
  }
  if (form.dataset.form === "book") {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const method = payload.id ? "PUT" : "POST";
    const url = payload.id ? `/api/librarian/books/${payload.id}` : "/api/librarian/books";
    if (!payload.totalCopies) payload.totalCopies = 1;
    
    if (pendingCoverFile) {
      const uploadData = new FormData();
      uploadData.append("cover", pendingCoverFile);
      try {
        const uploadRes = await fetchWithAuth("/api/librarian/upload-cover", {
          method: "POST",
          body: uploadData
        });
        if (uploadRes.ok) {
          const uploadResult = await uploadRes.json();
          payload.cover = uploadResult.url;
        }
      } catch (e) {
        console.error("Cover upload failed:", e);
      }
    }
    
    const response = await fetchWithAuth(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (response.offline) return;
    if (!response.ok) {
      const data = await response.json();
      toast(data.message || "Ошибка сохранения");
      return;
    }
    pendingCoverFile = null;
    setCoverPreview(null);
    closeModal("book-form");
    loadBooks();
    toast("Книга сохранена", "success");
  }
  if (form.dataset.form === "user") {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const response = await fetchWithAuth("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (response.offline) return;
    if (!response.ok) {
      const data = await response.json();
      toast(data.message || "Ошибка создания");
      return;
    }
    closeModal("user-form");
    loadUsers();
  }
});

document.querySelector("[data-input='catalog-search']").addEventListener("input", (event) => {
  state.catalogSearch = event.target.value;
});

let pendingCoverFile = null;

const setCoverPreview = (dataUrl) => {
  const preview = document.querySelector("[data-slot='cover-preview']");
  const removeBtn = document.querySelector("[data-action='remove-cover']");
  if (dataUrl) {
    preview.innerHTML = `<img src="${dataUrl}" alt="Обложка">`;
    preview.classList.add("has-image");
    removeBtn?.classList.remove("hidden");
  } else {
    preview.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><span>Перетащите изображение сюда</span><span class="cover-hint">или Ctrl+V для вставки</span>';
    preview.classList.remove("has-image");
    removeBtn?.classList.add("hidden");
  }
};

const handleCoverFile = (file) => {
  if (!file || !file.type.startsWith("image/")) {
    toast("Выберите изображение", "error");
    return;
  }
  pendingCoverFile = file;
  const reader = new FileReader();
  reader.onload = (e) => setCoverPreview(e.target.result);
  reader.readAsDataURL(file);
};

const dropzone = document.querySelector("[data-dropzone='cover']");
if (dropzone) {
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    handleCoverFile(file);
  });
  dropzone.addEventListener("click", () => {
    document.querySelector("[data-input='cover-file']").click();
  });
}

const fileInput = document.querySelector("[data-input='cover-file']");
if (fileInput) {
  fileInput.addEventListener("change", (e) => {
    handleCoverFile(e.target.files[0]);
  });
}

document.addEventListener("paste", (e) => {
  const bookModal = document.querySelector("[data-modal='book-form']");
  if (!bookModal || bookModal.classList.contains("hidden")) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      e.preventDefault();
      handleCoverFile(item.getAsFile());
      break;
    }
  }
});

document.querySelector("[data-input='catalog-genre']").addEventListener("change", (event) => {
  state.catalogGenre = event.target.value;
});

const updateLocationPreview = () => {
  const rowInput = document.querySelector("[data-input='location-row']");
  const shelfInput = document.querySelector("[data-input='location-shelf']");
  const hiddenInput = document.querySelector("[data-input='location-hidden']");
  const label = document.querySelector("[data-text='location-label']");
  const miniShelf = document.querySelector("[data-slot='mini-bookshelf']");
  
  if (!rowInput || !shelfInput) return;
  
  const row = parseInt(rowInput.value) || 1;
  const shelf = parseInt(shelfInput.value) || 1;
  
  hiddenInput.value = `Ряд ${row}, Полка ${shelf}`;
  label.textContent = `Ряд ${row}, Полка ${shelf}`;
  
  let html = '';
  for (let r = 1; r <= 10; r++) {
    for (let s = 1; s <= 5; s++) {
      const highlight = (r === row && s === Math.ceil(shelf / 4)) ? 'highlight' : '';
      html += `<div class="mini-shelf-cell ${highlight}"></div>`;
    }
  }
  miniShelf.innerHTML = html;
};

const rowInput = document.querySelector("[data-input='location-row']");
const shelfInput = document.querySelector("[data-input='location-shelf']");
if (rowInput && shelfInput) {
  rowInput.addEventListener("input", updateLocationPreview);
  shelfInput.addEventListener("input", updateLocationPreview);
  updateLocationPreview();
}

document.querySelector("[data-input='user-search']").addEventListener("input", () => loadUsers());

document.querySelector("[data-input='user-role']").addEventListener("change", () => loadUsers());

window.addEventListener("online", processQueue);

elements.overlay.addEventListener("click", closeMenu);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

initTheme();
loadCurrentUser();
