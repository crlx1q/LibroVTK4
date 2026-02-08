const state = {
  accessToken: localStorage.getItem("accessToken") || "",
  refreshToken: localStorage.getItem("refreshToken") || "",
  user: null,
  catalogPage: 1,
  catalogTotal: 0,
  catalogLimit: 8,
  catalogSearch: "",
  catalogGenre: "",
  catalogCategory: "",
  catalogSort: "",
  genres: [],
  categories: [],
  bookScan: null,
  studentScan: null,
  currentBookDetail: null,
  manualBooks: [],
  manualStudents: [],
  issueRequestBookId: null,
  currentRequest: null,
  librarianRequests: []
};

const elements = {
  views: document.querySelectorAll("[data-section]"),
  navItems: document.querySelectorAll(".nav-item"),
  toast: document.querySelector("[data-toast]"),
  menu: document.querySelector("[data-menu]"),
  overlay: document.querySelector("[data-overlay]"),
  authModal: document.querySelector("[data-modal='auth']"),
  burgerBtn: document.querySelector(".burger-btn"),
  headerLoginBtn: document.querySelector(".header-login-btn"),
  offlineBanner: document.querySelector("[data-banner='offline']")
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

// Логика статуса сети
let isAppOnline = navigator.onLine;

const updateConnectionStatus = (online) => {
  isAppOnline = online;
  const statusEl = document.querySelector("[data-status='connection']");
  if (statusEl) {
    statusEl.className = `connection-status ${online ? "online" : "offline"}`;
    statusEl.querySelector(".status-text").textContent = online ? "Онлайн" : "Оффлайн";
  }
  updateOfflineBanner();
};

const checkConnection = async () => {
  try {
    // Делаем легкий запрос к серверу для проверки реальной связи
    // Используем уникальный параметр, чтобы избежать кэширования
    const response = await fetch(`/api/health?t=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });
    if (!response.ok) {
      throw new Error("Health check failed");
    }
    if (!isAppOnline) updateConnectionStatus(true);
  } catch (e) {
    if (isAppOnline) updateConnectionStatus(false);
  }
};

// Слушатели событий сети
window.addEventListener("online", () => {
  updateConnectionStatus(true);
  checkConnection(); // Доп. проверка
});
window.addEventListener("offline", () => updateConnectionStatus(false));

// Периодическая проверка каждые 10 секунд
setInterval(checkConnection, 10000);

const isMobileLayout = () => window.matchMedia("(max-width: 980px)").matches;

const updateOfflineBanner = () => {
  if (!elements.offlineBanner) return;
  // Показываем баннер только если мы оффлайн
  elements.offlineBanner.classList.toggle("hidden", isAppOnline);
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
  if (isMobileLayout()) {
    elements.menu.classList.add("hidden");
    elements.overlay.classList.add("hidden");
    document.body.style.overflow = "";
  } else {
    elements.menu.classList.remove("hidden");
    elements.overlay.classList.add("hidden");
    document.body.style.overflow = "";
  }
};

const openMenu = () => {
  if (isMobileLayout()) {
    elements.menu.classList.remove("hidden");
    elements.overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  } else {
    elements.menu.classList.remove("hidden");
    elements.overlay.classList.add("hidden");
    document.body.style.overflow = "";
  }
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
    loadStudentProfile();
    loadStudentRequests();
    cacheStudentQr(); // Кэшируем QR для полуоффлайн режима
  }
  if (user.role === "librarian") {
    setActiveView("librarian-books");
    loadBooks();
    loadLibrarianLoans();
    loadLibrarianRequests();
    loadManualIssueData();
    initScanner();
    requestNotificationPermission();
  }
  if (user.role === "admin") {
    setActiveView("admin-users");
    loadUsers();
    loadAdminStats();
    loadAdminShelves();
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
    const studentViews = ["catalog", "student-loans", "favorites", "student-qr", "student-requests"];
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

const getAvailabilityMeta = (available, total) => {
  const availableCount = Math.max(0, Number(available) || 0);
  const totalCount = Math.max(1, Number(total) || 0);
  const ratio = totalCount > 0 ? availableCount / totalCount : 0;
  let badgeClass = "badge available";
  if (availableCount <= 0) {
    badgeClass = "badge unavailable";
  } else if (ratio <= 0.2) {
    badgeClass = "badge low";
  } else if (ratio <= 0.5) {
    badgeClass = "badge medium";
  }
  return {
    availableCount,
    totalCount,
    badgeClass,
    badgeText: `${availableCount} из ${totalCount} доступно`,
    cardUnavailable: availableCount <= 0
  };
};

const renderCatalog = (items) => {
  const container = document.querySelector("[data-list='catalog']");
  container.innerHTML = "";
  const sorted = [...items].sort((a, b) => {
    const aAvailable = Number(a.availableCopies || 0) > 0 ? 0 : 1;
    const bAvailable = Number(b.availableCopies || 0) > 0 ? 0 : 1;
    if (aAvailable !== bAvailable) return aAvailable - bAvailable;
    return (a.title || "").localeCompare(b.title || "");
  });
  sorted.forEach((book) => {
    const availability = getAvailabilityMeta(book.availableCopies, book.totalCopies);
    const unavailableClass = availability.cardUnavailable ? " unavailable" : "";
    const card = document.createElement("div");
    card.className = `card${unavailableClass}`;
    card.innerHTML = `
      <img src="${book.cover || "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=400&q=80"}" alt="${book.title}" data-action="details" data-id="${book.id}">
      <div class="card-title" data-action="details" data-id="${book.id}">${book.title}</div>
      <div class="card-meta">${book.author} · ${book.genre}</div>
      <div class="${availability.badgeClass}">${availability.badgeText}</div>
      <div class="card-actions">
        <button class="secondary-button" data-action="details" data-id="${book.id}">Подробнее</button>
        <button class="primary-button" data-action="take-book" data-id="${book.id}" ${availability.availableCount > 0 ? "" : "disabled"}>Взять</button>
        <button class="secondary-button" data-action="favorite" data-id="${book.id}">В избранное</button>
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

const updateStudentRequestsBadge = (count) => {
  const badge = document.querySelector("[data-slot='student-requests-badge']");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
};

const renderStudentRequests = (items) => {
  const container = document.querySelector("[data-list='student-requests']");
  if (!container) return;
  container.innerHTML = "";
  if (!items.length) {
    container.textContent = "Пока нет заявок";
    updateStudentRequestsBadge(0);
    return;
  }
  const pendingCount = items.filter((item) => item.status === "pending").length;
  updateStudentRequestsBadge(pendingCount);
  const sorted = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  sorted.forEach((request) => {
    const card = document.createElement("div");
    card.className = "request-card";
    const dueDate = request.dueDate ? new Date(request.dueDate).toLocaleDateString() : "";
    const statusTextMap = {
      pending: "На рассмотрении",
      rejected: "Отклонено",
      cancelled: "Отменено",
      issued: "Выдано",
      processed: "Обработано"
    };
    const statusText = statusTextMap[request.status] || request.status;
    card.innerHTML = `
      <div class="request-main">
        <div class="request-title">${request.bookTitle || "Книга"}</div>
        <div class="request-meta">
          ${request.bookAuthor ? `<span><i class="fas fa-pen-nib"></i> ${request.bookAuthor}</span>` : ""}
          ${request.bookLocation ? `<span><i class="fas fa-location-dot"></i> ${request.bookLocation}</span>` : ""}
          ${dueDate ? `<span><i class="fas fa-calendar-alt"></i> До ${dueDate}</span>` : ""}
        </div>
      </div>
      <div class="request-actions">
        <span class="request-status ${request.status}">${statusText}</span>
        ${request.status === "pending"
    ? `<button class="secondary-button" data-action="cancel-request" data-id="${request.id}">
              <i class="fas fa-ban"></i> Отменить
            </button>`
    : ""}
      </div>
    `;
    container.appendChild(card);
  });
};

const renderFavorites = (items) => {
  const container = document.querySelector("[data-list='favorites']");
  container.innerHTML = "";
  if (!items.length) {
    container.textContent = "Нет избранных книг";
    return;
  }
  const sorted = [...items].sort((a, b) => {
    const aAvailable = Number(a.book?.availableCopies || 0) > 0 ? 0 : 1;
    const bAvailable = Number(b.book?.availableCopies || 0) > 0 ? 0 : 1;
    if (aAvailable !== bAvailable) return aAvailable - bAvailable;
    return (a.book?.title || "").localeCompare(b.book?.title || "");
  });
  sorted.forEach((fav) => {
    if (!fav.book) return;
    const availability = getAvailabilityMeta(fav.book.availableCopies, fav.book.totalCopies);
    const card = document.createElement("div");
    card.className = `card${availability.cardUnavailable ? " unavailable" : ""}`;
    card.innerHTML = `
      <img src="${fav.book.cover || "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=400&q=80"}" alt="${fav.book.title}" data-action="details" data-id="${fav.book.id}">
      <div class="card-title" data-action="details" data-id="${fav.book.id}">${fav.book.title}</div>
      <div class="card-meta">${fav.book.author}</div>
      <div class="${availability.badgeClass}">${availability.badgeText}</div>
      <div class="card-actions">
        <button class="secondary-button" data-action="details" data-id="${fav.book.id}">Подробнее</button>
        <button class="primary-button" data-action="take-book" data-id="${fav.book.id}" ${availability.availableCount > 0 ? "" : "disabled"}>Взять</button>
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

const renderLibrarianRequests = (items) => {
  const container = document.querySelector("[data-list='librarian-requests']");
  if (!container) return;
  container.innerHTML = "";
  const pending = items.filter((request) => request.status === "pending");
  if (!pending.length) {
    container.innerHTML = '<div class="no-data">Запросов нет</div>';
    return;
  }
  pending.forEach((request) => {
    const card = document.createElement("div");
    card.className = "request-card";
    const contact = [request.studentPhone, request.studentIin].filter(Boolean).join(" · ");
    card.innerHTML = `
      <div class="request-main">
        <div class="request-title">${request.bookTitle || "Без названия"}</div>
        <div class="request-meta">
          <span><i class="fas fa-user"></i> ${request.studentName || "Студент"}</span>
          ${request.studentGroup ? `<span><i class="fas fa-users"></i> ${request.studentGroup}</span>` : ""}
          ${request.bookLocation ? `<span><i class="fas fa-location-dot"></i> ${request.bookLocation}</span>` : ""}
        </div>
        <div class="request-meta">
          <span><i class="fas fa-envelope"></i> ${request.studentEmail || "—"}</span>
          ${contact ? `<span><i class="fas fa-id-card"></i> ${contact}</span>` : ""}
          <span><i class="fas fa-book"></i> ${request.availableCopies || 0} из ${request.totalCopies || 0} доступно</span>
        </div>
      </div>
      <div class="request-actions">
        <button class="secondary-button" data-action="approve-request" data-id="${request.id}">
          <i class="fas fa-check"></i> Обработать
        </button>
        <button class="secondary-button" data-action="reject-request" data-id="${request.id}">
          <i class="fas fa-ban"></i> Отклонить
        </button>
      </div>
    `;
    container.appendChild(card);
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
            ${user.phone ? `<span class="user-phone"><i class="fas fa-phone"></i> ${user.phone}</span>` : ""}
            ${user.iin ? `<span class="user-iin"><i class="fas fa-id-card"></i> ${user.iin}</span>` : ""}
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
  const summary = document.querySelector("[data-slot='admin-loans-summary']");
  const statusCounts = items.reduce(
    (acc, loan) => {
      const status = loan.status || "активна";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { всего: items.length }
  );
  if (summary) {
    summary.innerHTML = `
      <div class="admin-loan-stat">
        <div class="stat-label">Всего выдач</div>
        <div class="stat-value">${statusCounts["всего"] || 0}</div>
      </div>
      <div class="admin-loan-stat">
        <div class="stat-label">Активные</div>
        <div class="stat-value">${statusCounts["активна"] || 0}</div>
      </div>
      <div class="admin-loan-stat">
        <div class="stat-label">Просроченные</div>
        <div class="stat-value">${statusCounts["просрочено"] || 0}</div>
      </div>
      <div class="admin-loan-stat">
        <div class="stat-label">Возвращенные</div>
        <div class="stat-value">${statusCounts["возвращена"] || 0}</div>
      </div>
    `;
  }
  items.forEach((loan) => {
    let statusClass = "badge";
    if (loan.status === "просрочено") {
      statusClass = "badge unavailable";
    } else if (loan.status === "активна") {
      statusClass = "badge available";
    }
    const row = document.createElement("div");
    row.className = "table-row";
    row.innerHTML = `
      <div>
        <strong>${loan.bookTitle}</strong>
        <div class="card-meta">${loan.bookAuthor || ""}</div>
      </div>
      <div>
        <strong>${loan.studentName}</strong>
        <div class="card-meta">${loan.studentEmail || ""}</div>
      </div>
      <div><span class="${statusClass}">${loan.status}</span></div>
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
    genre: state.catalogGenre,
    category: state.catalogCategory,
    sort: state.catalogSort
  });
  const response = await fetchWithAuth(`/api/student/catalog?${params.toString()}`);
  if (!response.ok) return;
  const data = await response.json();
  state.catalogTotal = data.total;
  renderCatalog(data.items);
  document.querySelector("[data-text='catalog-page']").textContent = String(state.catalogPage);
  const addOptions = (select, values, stateList) => {
    values.forEach((value) => {
      if (!value || stateList.includes(value)) return;
      stateList.push(value);
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  };
  const genreSelect = document.querySelector("[data-input='catalog-genre']");
  const categorySelect = document.querySelector("[data-input='catalog-category']");
  if (genreSelect) {
    addOptions(genreSelect, data.items.map((item) => item.genre), state.genres);
  }
  if (categorySelect) {
    addOptions(categorySelect, data.items.map((item) => item.category), state.categories);
  }
};

const loadStudentLoans = async () => {
  const response = await fetchWithAuth("/api/student/loans");
  if (!response.ok) return;
  const data = await response.json();
  renderStudentLoans(data);
};

const loadStudentRequests = async () => {
  const response = await fetchWithAuth("/api/student/requests");
  if (!response.ok) return;
  const data = await response.json();
  renderStudentRequests(data);
};

const loadFavorites = async () => {
  const response = await fetchWithAuth("/api/student/favorites");
  if (!response.ok) return;
  const data = await response.json();
  renderFavorites(data);
};

const loadStudentProfile = async () => {
  const response = await fetchWithAuth("/api/student/me");
  if (!response.ok) return;
  const user = await response.json();
  const avatarSlot = document.querySelector("[data-slot='profile-avatar']");
  const nameSlot = document.querySelector("[data-text='profile-name']");
  const emailSlot = document.querySelector("[data-text='profile-email']");
  const phoneSlot = document.querySelector("[data-text='profile-phone']");
  const iinSlot = document.querySelector("[data-text='profile-iin']");
  const groupSlot = document.querySelector("[data-text='profile-group']");
  if (nameSlot) nameSlot.textContent = user.fullName || "—";
  if (emailSlot) emailSlot.textContent = user.email || "—";
  if (phoneSlot) phoneSlot.textContent = user.phone || "—";
  if (iinSlot) iinSlot.textContent = user.iin || "—";
  if (groupSlot) groupSlot.textContent = user.group ? `Группа: ${user.group}` : "Группа не указана";
  if (avatarSlot) {
    if (user.avatarUrl) {
      avatarSlot.innerHTML = `<img src="${user.avatarUrl}" alt="${user.fullName}">`;
    } else {
      avatarSlot.innerHTML = '<i class="fas fa-user-graduate"></i>';
    }
  }
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
  state.manualBooks = data;
  renderManualIssueOptions();
};

const loadLibrarianLoans = async () => {
  const response = await fetchWithAuth("/api/librarian/loans");
  if (!response.ok) return;
  const data = await response.json();
  renderLibrarianLoans(data);
};

const loadLibrarianRequests = async () => {
  const response = await fetchWithAuth("/api/librarian/requests");
  if (!response.ok) return;
  const data = await response.json();
  state.librarianRequests = data;
  renderLibrarianRequests(data);
};

const loadManualIssueData = async () => {
  try {
    const [booksResponse, studentsResponse] = await Promise.all([
      fetchWithAuth("/api/librarian/books"),
      fetchWithAuth("/api/librarian/students")
    ]);
    if (booksResponse.ok) {
      const books = await booksResponse.json();
      state.manualBooks = books;
    }
    if (studentsResponse.ok) {
      const students = await studentsResponse.json();
      state.manualStudents = students;
    }
    renderManualIssueOptions();
  } catch (error) {
    console.warn("Manual issue data fetch failed", error);
  }
};

const renderManualIssueOptions = () => {
  const studentSelect = document.querySelector("[data-input='manual-student']");
  const bookSelect = document.querySelector("[data-input='manual-book']");
  if (!studentSelect || !bookSelect) return;
  studentSelect.innerHTML = `
    <option value="">Выберите студента</option>
    ${state.manualStudents
      .map((student) => {
        const group = student.group ? ` · ${student.group}` : "";
        const iin = student.iin ? ` · ИИН ${student.iin}` : "";
        const phone = student.phone ? ` · ${student.phone}` : "";
        return `<option value="${student.id}">${student.fullName}${group}${iin}${phone}</option>`;
      })
      .join("")}
  `;
  bookSelect.innerHTML = `
    <option value="">Выберите книгу</option>
    ${state.manualBooks
      .map((book) => {
        const unavailable = Number(book.availableCopies || 0) <= 0;
        const availability = unavailable ? " · нет в наличии" : "";
        return `<option value="${book.id}" ${unavailable ? "disabled" : ""}>${book.title}${book.author ? ` — ${book.author}` : ""}${availability}</option>`;
      })
      .join("")}
  `;
};

const setDefaultDueDate = (input) => {
  if (!input) return;
  const date = new Date();
  date.setDate(date.getDate() + 14);
  input.value = date.toISOString().split("T")[0];
};

const openRequestIssueModal = (request) => {
  if (!request) return;
  state.currentRequest = request;
  const bookSlot = document.querySelector("[data-text='request-book-title']");
  const studentSlot = document.querySelector("[data-text='request-student-name']");
  const contactSlot = document.querySelector("[data-text='request-student-contact']");
  const dueInput = document.querySelector("[data-input='request-due-date']");
  if (bookSlot) bookSlot.textContent = request.bookTitle || "—";
  if (studentSlot) studentSlot.textContent = request.studentName || "—";
  if (contactSlot) {
    const contact = [request.studentEmail, request.studentPhone, request.studentIin].filter(Boolean).join(" · ");
    contactSlot.textContent = contact || "—";
  }
  setDefaultDueDate(dueInput);
  openModal("request-issue");
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

const loadAdminShelves = async () => {
  const response = await fetchWithAuth("/api/librarian/books");
  if (!response.ok) return;
  const data = await response.json();
  renderAdminShelves(data);
};

const loadAdminLoans = async () => {
  const response = await fetchWithAuth("/api/admin/loans");
  if (!response.ok) return;
  const data = await response.json();
  renderAdminLoans(data);
};

const renderAdminShelves = (books) => {
  const container = document.querySelector("[data-list='shelf-map']");
  if (!container) return;
  if (!books.length) {
    container.innerHTML = '<div class="no-data">Нет данных о книгах</div>';
    return;
  }
  const shelfBooks = books.filter((book) => (book.availableCopies || 0) > 0);
  const locations = shelfBooks
    .map((book) => {
      const rowMatch = book.location?.match(/ряд\s*(\d+)/i);
      const shelfMatch = book.location?.match(/полка\s*(\d+)/i);
      const row = rowMatch ? Number(rowMatch[1]) : null;
      const shelf = shelfMatch ? Number(shelfMatch[1]) : null;
      return { row, shelf, title: book.title, author: book.author, location: book.location || "", cover: book.cover };
    })
    .filter((item) => Number.isFinite(item.row) && Number.isFinite(item.shelf));
  const unlocated = shelfBooks.filter((book) => !book.location);
  const maxRow = Math.max(10, ...locations.map((loc) => loc.row || 0));
  const maxShelf = Math.max(10, ...locations.map((loc) => loc.shelf || 0));
  const map = new Map();
  locations.forEach((loc) => {
    const key = `${loc.row}-${loc.shelf}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(loc);
  });
  const summary = document.createElement("div");
  summary.className = "shelf-summary";
  summary.innerHTML = `
    <div class="shelf-summary-item"><i class="fas fa-book"></i> <strong>${books.length}</strong> книг в фонде</div>
    <div class="shelf-summary-item"><i class="fas fa-warehouse"></i> <strong>${shelfBooks.length}</strong> сейчас на полках</div>
    <div class="shelf-summary-item"><i class="fas fa-question-circle"></i> <strong>${unlocated.length}</strong> без полки</div>
  `;
  const grid = document.createElement("div");
  grid.className = "shelf-grid";
  grid.style.gridTemplateColumns = `repeat(${maxShelf}, minmax(50px, 1fr))`;
  for (let row = 1; row <= maxRow; row++) {
    for (let shelf = 1; shelf <= maxShelf; shelf++) {
      const key = `${row}-${shelf}`;
      const entries = map.get(key) || [];
      const cell = document.createElement("div");
      cell.className = `shelf-cell${entries.length ? " has-books" : " empty"}`;
      if (entries.length) {
        cell.innerHTML = `<div class="book-count">${entries.length}</div>`;
        cell.addEventListener("click", () => {
          const popup = document.createElement("div");
          popup.className = "shelf-popup";
          popup.innerHTML = `
            <div class="shelf-popup-backdrop"></div>
            <div class="shelf-popup-content">
              <div class="shelf-popup-header">
                <h3><i class="fas fa-map-marker-alt"></i> Ряд ${row}, Полка ${shelf}</h3>
                <button class="shelf-popup-close"><i class="fas fa-times"></i></button>
              </div>
              <div class="shelf-popup-list">
                ${entries.map(e => `
                  <div class="shelf-popup-item">
                    <i class="fas fa-book"></i>
                    <div>
                      <div class="shelf-popup-title">${e.title}</div>
                      <div class="shelf-popup-author">${e.author || ""}</div>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          `;
          document.body.appendChild(popup);
          popup.querySelector(".shelf-popup-backdrop").addEventListener("click", () => popup.remove());
          popup.querySelector(".shelf-popup-close").addEventListener("click", () => popup.remove());
        });
      }
      grid.appendChild(cell);
    }
  }
  const unlocatedList = document.createElement("div");
  unlocatedList.className = "shelf-unlocated";
  const emptyShelfMessage = shelfBooks.length
    ? "Все книги размещены на полках"
    : "Сейчас нет книг на полках";
  unlocatedList.innerHTML = unlocated.length
    ? `<div class="shelf-unlocated-title">Книги без указанной полки</div>
       <div class="shelf-unlocated-list">
         ${unlocated
      .slice(0, 6)
      .map((book) => `<span>${book.title}${book.author ? ` — ${book.author}` : ""}</span>`)
      .join("")}
         ${unlocated.length > 6 ? `<span>и еще ${unlocated.length - 6}...</span>` : ""}
       </div>`
    : `<div class="shelf-unlocated-title">${emptyShelfMessage}</div>`;
  container.innerHTML = "";
  container.appendChild(summary);
  container.appendChild(grid);
  container.appendChild(unlocatedList);
};

const openModal = (name) => {
  document.querySelector(`[data-modal='${name}']`).classList.remove("hidden");
};

const closeModal = (name) => {
  document.querySelector(`[data-modal='${name}']`).classList.add("hidden");
};

// Кэш QR-кода студента для полуоффлайн режима
let cachedStudentQr = localStorage.getItem("cachedStudentQr") || "";

// Функция показа модального окна QR для выдачи книги
const showIssueQrModal = async (book) => {
  const hasStudentQr = !!cachedStudentQr;
  state.issueRequestBookId = book?.id || null;
  const requestBtn = document.querySelector("[data-action='send-issue-request']");
  if (requestBtn) {
    requestBtn.disabled = !isAppOnline;
    requestBtn.title = isAppOnline ? "" : "Нет подключения к интернету";
  }

  // Скрываем все режимы
  document.querySelectorAll("[data-issue-mode]").forEach(el => el.classList.add("hidden"));

  // Сначала проверяем глобальный статус оффлайн
  // Если мы точно знаем что мы оффлайн - сразу показываем оффлайн режим, не пытаясь делать fetch
  if (isAppOnline) {
    // Пытаемся сгенерировать онлайн QR
    try {
      const response = await fetchWithAuth("/api/student/issue-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id })
      });

      if (response.ok) {
        const data = await response.json();

        // Показываем онлайн режим
        document.querySelector("[data-issue-mode='online']").classList.remove("hidden");
        document.querySelector("[data-slot='issue-qr-image']").innerHTML = `<img src="${data.qrCodeDataUrl}" alt="QR">`;
        document.querySelector("[data-text='issue-book-title']").textContent = data.book.title;
        document.querySelector("[data-text='issue-expires']").textContent = data.expiresIn;

        openModal("issue-qr");
        toast("QR-код сгенерирован на 30 минут", "success");
        return;
      }

      // Если сервер вернул ошибку - тоже fallback
    } catch (e) {
      console.warn("Issue QR generation failed, falling back to offline mode", e);
    }
  }

  // Оффлайн режим (или если запрос упал)
  if (hasStudentQr) {
    // Полуоффлайн - есть кэш QR студента
    document.querySelector("[data-issue-mode='semi']").classList.remove("hidden");
    document.querySelector("[data-slot='issue-qr-student']").innerHTML = `<img src="${cachedStudentQr}" alt="QR">`;
    openModal("issue-qr");
    toast("Нет связи: покажите свой QR и книгу библиотекарю", "info");
  } else {
    // Полный оффлайн - нет данных
    document.querySelector("[data-issue-mode='offline']").classList.remove("hidden");
    openModal("issue-qr");
    toast("Нет связи: покажите книгу и назовите ФИО, телефон или ИИН", "info");
  }
};

// Кэширование QR студента при загрузке
const cacheStudentQr = async () => {
  if (!navigator.onLine || !state.accessToken) return;
  try {
    const response = await fetchWithAuth("/api/student/qr");
    if (response.ok) {
      const data = await response.json();
      cachedStudentQr = data.qrCodeDataUrl;
      localStorage.setItem("cachedStudentQr", cachedStudentQr);
    }
  } catch (e) {
    console.warn("Failed to cache student QR", e);
  }
};

const fetchBookDetail = async (bookId) => {
  if (!bookId) return null;
  try {
    const response = await fetch(`/api/student/books/${bookId}`, {
      headers: {
        "Authorization": `Bearer ${state.accessToken}`,
        "Cache-Control": "no-cache"
      }
    });
    if (!response.ok) {
      console.error("Details fetch failed:", response.status);
      return null;
    }
    const book = await response.json();
    if (!book || !book.title) {
      console.error("Invalid book data:", book);
      return null;
    }
    return book;
  } catch (err) {
    console.error("Details error:", err);
    return null;
  }
};

const openBookDetail = async (bookId) => {
  const book = await fetchBookDetail(bookId);
  if (!book) {
    toast("Ошибка загрузки книги", "error");
    return;
  }
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
  const takeBtn = document.querySelector("[data-action='take-book-detail']");
  if (takeBtn) {
    takeBtn.disabled = (book.availableCopies || 0) <= 0;
  }

  const locationText = document.querySelector("[data-text='book-detail-location']");
  const studentShelf = document.querySelector("[data-slot='student-bookshelf']");
  const hasLocation = !!book.location;
  const hasCopies = (book.availableCopies || 0) > 0;
  if (locationText) {
    if (!hasLocation) {
      locationText.textContent = "Расположение не указано";
    } else if (!hasCopies) {
      locationText.textContent = "Сейчас книги на полке нет";
    } else {
      locationText.textContent = book.location;
    }
  }
  if (studentShelf) {
    studentShelf.innerHTML = "";
    if (hasLocation && hasCopies) {
      let row = 1, shelf = 1;
      const rowMatch = book.location.match(/ряд\s*(\d+)/i);
      const shelfMatch = book.location.match(/полка\s*(\d+)/i);
      if (rowMatch) row = parseInt(rowMatch[1]);
      if (shelfMatch) shelf = parseInt(shelfMatch[1]);
      let shelfHtml = "";
      for (let r = 1; r <= 10; r++) {
        for (let s = 1; s <= 10; s++) {
          const isHighlight = (r === row && s === shelf) ? "highlight" : "";
          shelfHtml += `<div class="bookshelf-cell ${isHighlight}"></div>`;
        }
      }
      studentShelf.innerHTML = shelfHtml;
    }
  }

  const qrSlot = document.querySelector("[data-slot='book-qr-image']");
  if (book.qrCodeDataUrl) {
    qrSlot.innerHTML = `<img src="${book.qrCodeDataUrl}" alt="QR">`;
  } else {
    qrSlot.innerHTML = '<span style="color:#94a3b8;font-size:13px">QR-код не сгенерирован</span>';
  }

  openModal("book-detail");
};

const openIssueQrForBookId = async (bookId) => {
  const book = await fetchBookDetail(bookId);
  if (!book) {
    toast("Ошибка загрузки книги", "error");
    return;
  }
  if ((book.availableCopies || 0) <= 0) {
    toast("Книга сейчас недоступна", "info");
    return;
  }
  showIssueQrModal(book);
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
  } catch (e) { }
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

    const scan = async () => {
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
          } else if (parsed.type === "issue" && parsed.code) {
            // Новый тип - единый QR для выдачи
            try {
              const response = await fetchWithAuth(`/api/librarian/resolve-issue-qr?code=${parsed.code}`);
              if (response.ok) {
                const issueData = await response.json();
                state.bookScan = issueData.bookId;
                state.studentScan = issueData.studentId;
                document.querySelector("[data-text='book-scan']").textContent = issueData.bookTitle || "Книга";
                document.querySelector("[data-text='student-scan']").textContent = issueData.studentName || "Студент";
                beepSound();
                toast(`${issueData.studentName}: ${issueData.bookTitle}`, "success");
                statusEl.textContent = "Готово к выдаче!";
              } else {
                const err = await response.json().catch(() => ({ message: "Ошибка" }));
                toast(err.message || "QR-код недействителен", "error");
              }
            } catch (e) {
              toast("Ошибка проверки QR-кода", "error");
            }
          }
          if (state.bookScan && state.studentScan) {
            statusEl.textContent = "Готово к выдаче!";
          }
        } catch (e) { }
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

let studentScannerStream = null;
let studentScannerActive = false;

const stopStudentScanner = () => {
  if (studentScannerStream) {
    studentScannerStream.getTracks().forEach(track => track.stop());
    studentScannerStream = null;
  }
  studentScannerActive = false;
  const video = document.querySelector("[data-video='student-scanner']");
  if (video) video.srcObject = null;
  const btn = document.querySelector("[data-action='start-student-scanner']");
  if (btn) {
    btn.innerHTML = '<i class="fas fa-camera"></i> Запустить сканер';
  }
};

const startStudentScanner = async () => {
  const video = document.querySelector("[data-video='student-scanner']");
  const btn = document.querySelector("[data-action='start-student-scanner']");
  if (!video || !btn) return;

  if (studentScannerActive) {
    stopStudentScanner();
    return;
  }

  try {
    studentScannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = studentScannerStream;
    studentScannerActive = true;
    btn.innerHTML = '<i class="fas fa-stop"></i> Остановить сканер';

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const scan = async () => {
      if (!studentScannerActive) return;
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
          if (parsed.type === "book" && parsed.bookId) {
            toast("Книга распознана", "success");
            stopStudentScanner();
            closeModal("student-scanner");
            await openBookDetail(parsed.bookId);
            return;
          }
        } catch (e) { }
      }

      requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  } catch (error) {
    toast("Нет доступа к камере. Разрешите доступ в настройках браузера.", "error");
  }
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
  if (name === "open-student-scanner") {
    openModal("student-scanner");
    startStudentScanner();
  }
  if (name === "start-student-scanner") {
    startStudentScanner();
  }
  if (name === "close-student-scanner") {
    stopStudentScanner();
    closeModal("student-scanner");
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
  if (name === "requests-refresh") {
    loadLibrarianRequests();
  }
  if (name === "take-book") {
    const bookId = action.dataset.id;
    openIssueQrForBookId(bookId);
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
    if (!bookId) return;
    openBookDetail(bookId);
  }
  if (name === "close-book-detail") {
    closeModal("book-detail");
  }
  if (name === "close-issue-qr") {
    closeModal("issue-qr");
    state.issueRequestBookId = null;
  }
  if (name === "send-issue-request") {
    const bookId = state.issueRequestBookId || state.currentBookDetail?.id;
    if (!bookId) {
      toast("Не удалось определить книгу", "error");
      return;
    }
    const response = await fetchWithAuth("/api/student/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId })
    });
    if (response.offline) return;
    const data = await response.json();
    toast(data.message || "Запрос отправлен библиотекарю", "success");
    closeModal("issue-qr");
    loadStudentRequests();
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
  if (name === "take-book-detail") {
    if (!state.currentBookDetail) return;
    if ((state.currentBookDetail.availableCopies || 0) <= 0) {
      toast("Книга сейчас недоступна", "info");
      return;
    }

    // Показываем модальное окно QR для выдачи
    closeModal("book-detail");
    showIssueQrModal(state.currentBookDetail);
  }
  if (name === "cancel-request") {
    const requestId = action.dataset.id;
    const response = await fetchWithAuth(`/api/student/requests/${requestId}/cancel`, {
      method: "POST"
    });
    if (response.offline) return;
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: "Ошибка" }));
      toast(data.message || "Ошибка отмены", "error");
      return;
    }
    toast("Заявка отменена", "success");
    loadStudentRequests();
  }
  if (name === "approve-request") {
    const requestId = action.dataset.id;
    const request = state.librarianRequests.find((item) => item.id === requestId);
    if (!request) {
      toast("Запрос не найден", "error");
      return;
    }
    openRequestIssueModal(request);
  }
  if (name === "reject-request") {
    const requestId = action.dataset.id;
    const response = await fetchWithAuth(`/api/librarian/requests/${requestId}/reject`, {
      method: "POST"
    });
    if (response.offline) return;
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: "Ошибка" }));
      toast(data.message || "Ошибка отклонения", "error");
      return;
    }
    toast("Запрос отклонён", "success");
    loadLibrarianRequests();
  }
  if (name === "confirm-request-issue") {
    if (!state.currentRequest) {
      toast("Запрос не выбран", "error");
      return;
    }
    const dueInput = document.querySelector("[data-input='request-due-date']");
    const dueDate = dueInput?.value;
    if (!dueDate) {
      toast("Укажите срок возврата", "error");
      return;
    }
    const response = await fetchWithAuth(`/api/librarian/requests/${state.currentRequest.id}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate })
    });
    if (response.offline) return;
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: "Ошибка" }));
      toast(data.message || "Ошибка выдачи", "error");
      return;
    }
    toast("Выдача подтверждена", "success");
    closeModal("request-issue");
    state.currentRequest = null;
    loadLibrarianRequests();
    loadLibrarianLoans();
    loadBooks();
  }
  if (name === "close-request-issue") {
    state.currentRequest = null;
    closeModal("request-issue");
  }
  if (name === "upload-avatar") {
    const input = document.querySelector("[data-input='avatar-file']");
    if (input) input.click();
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
  if (name === "issue-book-manual") {
    const studentSelect = document.querySelector("[data-input='manual-student']");
    const bookSelect = document.querySelector("[data-input='manual-book']");
    const statusEl = document.querySelector("[data-text='issue-status']");
    const studentId = studentSelect?.value;
    const bookId = bookSelect?.value;
    if (!studentId || !bookId) {
      toast("Выберите студента и книгу", "error");
      return;
    }
    const dueDate = document.querySelector("[data-input='due-date']").value;
    const response = await fetchWithAuth("/api/librarian/loans/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, studentId, dueDate })
    });
    if (response.offline) return;
    if (response.ok) {
      toast("Выдача оформлена вручную!", "success");
      if (statusEl) statusEl.textContent = "Ручная выдача оформлена успешно!";
      if (bookSelect) bookSelect.value = "";
      if (studentSelect) studentSelect.value = "";
      loadBooks();
      loadLibrarianLoans();
    } else {
      const data = await response.json().catch(() => ({ message: "Ошибка" }));
      toast(data.message || "Ошибка выдачи", "error");
      if (statusEl) statusEl.textContent = data.message || "Ошибка";
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
    loadAdminShelves();
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

const avatarInput = document.querySelector("[data-input='avatar-file']");
if (avatarInput) {
  avatarInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Выберите изображение", "error");
      return;
    }
    const formData = new FormData();
    formData.append("avatar", file);
    const response = await fetchWithAuth("/api/student/avatar", {
      method: "POST",
      body: formData
    });
    if (response.offline) return;
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast(data.message || "Не удалось загрузить аватар", "error");
      return;
    }
    const data = await response.json();
    const avatarSlot = document.querySelector("[data-slot='profile-avatar']");
    if (avatarSlot) {
      avatarSlot.innerHTML = `<img src="${data.url}" alt="Аватар">`;
    }
    toast("Аватар обновлен", "success");
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
  state.catalogPage = 1;
  loadCatalog();
});

document.querySelector("[data-input='catalog-category']").addEventListener("change", (event) => {
  state.catalogCategory = event.target.value;
  state.catalogPage = 1;
  loadCatalog();
});

document.querySelector("[data-input='catalog-sort']").addEventListener("change", (event) => {
  state.catalogSort = event.target.value;
  state.catalogPage = 1;
  loadCatalog();
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

window.addEventListener("online", () => {
  updateOfflineBanner();
  processQueue();
});
window.addEventListener("offline", updateOfflineBanner);

elements.overlay.addEventListener("click", closeMenu);

const canUseServiceWorkers = "serviceWorker" in navigator;

if (canUseServiceWorkers) {
  navigator.serviceWorker.register("sw.js");
  navigator.serviceWorker.register("firebase-messaging-sw.js");
}

const firebaseConfig = {
  apiKey: "AIzaSyCRHXd_7p77EH-onhpuRtZskroS7sY_dHc",
  authDomain: "assist-97363.firebaseapp.com",
  projectId: "assist-97363",
  storageBucket: "assist-97363.firebasestorage.app",
  messagingSenderId: "700060547241",
  appId: "1:700060547241:web:d7eb3554e5e8589e0f91b8"
};

let firebaseApp = null;
let messaging = null;

const initFirebase = async () => {
  try {
    if (!canUseServiceWorkers || typeof Notification === "undefined") {
      console.info("Push notifications are not supported in this browser");
      return;
    }

    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
    const { getMessaging, onMessage, isSupported } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js");

    const messagingSupported = await isSupported();
    if (!messagingSupported) {
      console.info("Firebase messaging is not supported in this browser");
      return;
    }

    firebaseApp = initializeApp(firebaseConfig);
    messaging = getMessaging(firebaseApp);

    onMessage(messaging, (payload) => {
      console.log("Push received:", payload);
      toast(payload.notification?.body || "Новое уведомление", "info");
    });

    console.log("Firebase initialized");
  } catch (err) {
    console.warn("Firebase init error:", err);
  }
};

const requestNotificationPermission = async () => {
  if (!messaging || typeof Notification === "undefined") return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const { getToken } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js");
      const token = await getToken(messaging, {
        vapidKey: "BELcEis0aj3NRkb_VjLF8l6tjq2vMBUGPmbJznsm1o3AFGzBS6A6UhhAw-PR5xFMGRmPyykDKR-KgJejk-64RVA"
      });
      if (token) {
        console.log("FCM Token:", token);
        await saveFcmToken(token);
        return token;
      }
    }
  } catch (err) {
    console.warn("Notification permission error:", err);
  }
  return null;
};

const saveFcmToken = async (token) => {
  try {
    await fetchWithAuth("/api/user/fcm-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
  } catch (err) {
    console.warn("Save FCM token error:", err);
  }
};

initFirebase();

initTheme();
loadCurrentUser();
updateOfflineBanner();

const updateCatalogLimit = () => {
  const nextLimit = window.innerWidth <= 640 ? 4 : 8;
  if (state.catalogLimit !== nextLimit) {
    state.catalogLimit = nextLimit;
    state.catalogPage = 1;
    if (state.user && state.user.role === "student") {
      loadCatalog();
    }
  }
};

updateCatalogLimit();
window.addEventListener("resize", updateCatalogLimit);
