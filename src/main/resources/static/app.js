(() => {
  "use strict";

  const DATA_KEY = "zalastore.data.v1";
  const SESSION_KEY = "zalastore.session.v1";
  const THEME_KEY = "zalastore.theme.v1";
  const PAGE_FILES = {
    store: "index.html",
    cart: "cart.html",
    orders: "orders.html",
    profile: "profile.html",
    inventory: "inventory.html",
    dashboard: "dashboard.html",
    sales: "sales.html",
    reports: "reports.html",
    users: "users.html",
    auth: "login.html",
    product: "product.html"
  };
  const money = new Intl.NumberFormat("az-AZ", { style: "currency", currency: "AZN" });
  const dateTime = new Intl.DateTimeFormat("az-AZ", { dateStyle: "medium", timeStyle: "short" });
  const dateOnly = new Intl.DateTimeFormat("az-AZ", { dateStyle: "medium" });
  let database;
  let currentView = document.querySelector("main")?.dataset.page || "store";
  let authMode = "login";
  let reportPeriod = "day";
  let currentFilteredSales = [];
  let currentReportSales = [];
  let catalogRequestId = 0;
  let lowStockProductIds = new Set();
  let allowedPages = [];

  const byId = (id) => document.getElementById(id);
  async function apiRequest(path, method, body) {
    return window.StoreService.request(path, method, body);
  }
  async function apiCsvRequest(path, body) {
    if (path !== "/api/sales/export") throw new Error(`CSV əməliyyatı dəstəklənmir: ${path}`);
    return window.StoreService.csv(body);
  }
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const formatMoney = (amount) => money.format(Number(amount) || 0);
  const localDateValue = (date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };
  const initials = (name) => String(name || "").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  const safeColor = (value) => /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#a7b2a0";

  async function loadDatabase() {
    const saved = localStorage.getItem(DATA_KEY);
    if (!saved) {
      const seed = await apiRequest("/api/demo/seed", "POST", {});
      database = { products: seed.products, users: seed.users, sales: [], carts: {} };
      saveDatabase();
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.users) ||
          !Array.isArray(parsed.sales) || typeof parsed.carts !== "object" || parsed.carts === null) {
        throw new Error("Yaddaş formatı gözlənilən quruluşa uyğun deyil.");
      }
      database = parsed;
    } catch (error) {
      throw new Error(`ZalaStore yaddaşını oxumaq mümkün olmadı: ${error.message}`);
    }
  }

  function saveDatabase() {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(database));
    } catch (error) {
      showToast(`Məlumatı brauzerdə saxlamaq mümkün olmadı: ${error.message}`, true);
      throw error;
    }
  }

  function currentUser() {
    const id = localStorage.getItem(SESSION_KEY);
    return database.users.find((user) => user.id === id) || null;
  }

  function setSession(user) {
    if (user) localStorage.setItem(SESSION_KEY, user.id);
    else localStorage.removeItem(SESSION_KEY);
    allowedPages = [];
    syncShell();
  }

  function showToast(message, isError = false) {
    const region = byId("toast-region");
    if (!region) return;
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " error" : ""}`;
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  async function showView(view) {
    try {
      const result = await apiRequest("/api/access", "POST", { actor: currentUser(), page: view });
      if (!result.allowed) {
        showToast(currentUser() ? "Bu bölməyə giriş icazən yoxdur." : "Bu bölmə üçün hesabına daxil ol.", true);
        window.location.assign(`/${currentUser() ? PAGE_FILES.store : PAGE_FILES.auth}`);
        return;
      }
      window.location.assign(`/${PAGE_FILES[view] || PAGE_FILES.store}`);
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function applyTheme(theme) {
    const selected = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = selected;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = selected === "dark" ? "#171a18" : "#f7f5f1";
    const button = byId("theme-toggle");
    if (button) {
      button.textContent = selected === "dark" ? "☀" : "☾";
      button.setAttribute("aria-label", selected === "dark" ? "Gündüz rejiminə keç" : "Gecə rejiminə keç");
      button.setAttribute("aria-pressed", String(selected === "dark"));
      button.title = selected === "dark" ? "Gündüz rejimi" : "Gecə rejimi";
    }
  }

  function initializeTheme() {
    let savedTheme;
    try {
      savedTheme = localStorage.getItem(THEME_KEY);
    } catch (error) {
      showToast(`Tema seçimini oxumaq mümkün olmadı: ${error.message}`, true);
    }
    applyTheme(savedTheme);
  }

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch (error) {
      showToast(`Tema seçimini saxlamaq mümkün olmadı: ${error.message}`, true);
    }
  }

  function syncShell() {
    const user = currentUser();
    document.querySelectorAll(".nav-link, .cart-account-button").forEach((element) => {
      element.classList.toggle("hidden", !allowedPages.includes(element.dataset.view));
      element.classList.toggle("active", element.dataset.view === currentView);
    });
    document.body.classList.add("access-ready");
    if (byId("login-open")) byId("login-open").classList.toggle("hidden", Boolean(user) || currentView === "auth");
    if (byId("logout-button")) byId("logout-button").classList.toggle("hidden", !user);
    if (byId("user-chip")) {
      byId("user-chip").classList.toggle("hidden", !user || user.role !== "CUSTOMER");
      byId("user-chip").textContent = user?.role === "CUSTOMER" ? user.name : "";
    }
    updateCartCount();
  }

  function roleName(role) {
    return ({ ADMIN: "Admin", STAFF: "İşçi", CUSTOMER: "Müştəri" })[role] || "İstifadəçi";
  }

  function productImage(product) {
    const color = safeColor(product.color);
    const category = String(product.category || "").toLocaleLowerCase("az");
    let garment = `<path d="M72 46 94 35l13 17 15-17 22 11-12 33-13-6v86H84V73l-13 6z" fill="${color}" stroke="#ffffff" stroke-opacity=".55" stroke-width="2"/>`;
    if (category.includes("şalvar")) {
      garment = `<path d="M81 35h48l7 106-24 4-8-67-9 67-24-4z" fill="${color}" stroke="#ffffff" stroke-opacity=".5" stroke-width="2"/><path d="M82 48h46" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`;
    } else if (category.includes("don")) {
      garment = `<path d="M91 35h30l12 34 19 75H60l19-75z" fill="${color}" stroke="#ffffff" stroke-opacity=".52" stroke-width="2"/><path d="m92 37-10 34h47l-10-34M82 71h47" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>`;
    } else if (category.includes("gödəkçə") || category.includes("sviter")) {
      garment = `<path d="m75 43 21-9 12 16 12-16 21 9 13 39-17 7-8-20v68H87V69l-8 20-17-7z" fill="${color}" stroke="#ffffff" stroke-opacity=".55" stroke-width="2"/><path d="m108 51 0 86m-7-86 7 8 7-8" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>`;
    } else if (category.includes("aksesuar")) {
      garment = `<path d="M72 70h72l-6 76H78z" fill="${color}" stroke="#ffffff" stroke-opacity=".55" stroke-width="2"/><path d="M88 72V58c0-26 39-26 39 0v14" fill="none" stroke="${color}" stroke-width="8"/><path d="M72 87h72" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`;
    }
    return `<svg class="product-illustration" viewBox="0 0 220 180" role="img" aria-label="${escapeHtml(product.name)} nümunə şəkli" xmlns="http://www.w3.org/2000/svg"><ellipse cx="110" cy="156" rx="55" ry="8" fill="#465044" opacity=".12"/><g>${garment}</g><circle cx="168" cy="42" r="20" fill="#fff" opacity=".25"/><path d="M158 43h20M168 33v20" stroke="#fff" stroke-opacity=".65" stroke-width="1.5"/></svg>`;
  }

  function stockLabel(product) {
    if (lowStockProductIds.has(product.id)) {
      return `<span class="stock-tag low">Az qalıb: ${Number(product.stock)}</span>`;
    }
    return `<span class="stock-tag">Stokda: ${Number(product.stock)}</span>`;
  }

  async function renderStore() {
    if (!database) return;
    const categorySelect = byId("category-filter");
    const selectedCategory = categorySelect.value;
    const requestId = ++catalogRequestId;
    let catalog;
    try {
      catalog = await apiRequest("/api/catalog/search", "POST", {
        products: database.products,
        search: byId("product-search").value.trim(),
        category: selectedCategory
      });
    } catch (error) {
      if (requestId === catalogRequestId) showToast(error.message, true);
      return;
    }
    if (requestId !== catalogRequestId) return;
    const categories = catalog.categories;
    categorySelect.innerHTML = `<option value="">Bütün kateqoriyalar</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
    if (categories.includes(selectedCategory)) categorySelect.value = selectedCategory;

    const products = catalog.products;
    const lowStock = catalog.lowStock;
    lowStockProductIds = new Set(lowStock.map((product) => product.id));

    const grid = byId("product-grid");
    if (!products.length) {
      grid.innerHTML = `<div class="empty-state"><strong>Məhsul tapılmadı</strong>Axtarış sözünü və ya kateqoriyanı dəyiş.</div>`;
      return;
    }
    const productsByCategory = new Map();
    products.forEach((product) => {
      const categoryProducts = productsByCategory.get(product.category) || [];
      categoryProducts.push(product);
      productsByCategory.set(product.category, categoryProducts);
    });
    grid.innerHTML = categories
      .filter((category) => productsByCategory.has(category))
      .map((category) => `
        <section class="catalog-category">
          <div class="catalog-category-heading"><h3>${escapeHtml(category)}</h3><span>${productsByCategory.get(category).length} məhsul</span></div>
          <div class="product-grid">${productsByCategory.get(category).map((product) => `
            <article class="product-card" style="--product-soft:${safeColor(product.color)}22">
              <a class="product-card-link" href="/products/${encodeURIComponent(product.id)}" aria-label="${escapeHtml(product.name)} məhsulunun detallarına bax">
                <div class="card-image">${productImage(product)}${lowStockProductIds.has(product.id) ? stockLabel(product) : ""}</div>
                <div class="card-info"><span class="product-category">${escapeHtml(product.category)}</span><h3>${escapeHtml(product.name)}</h3></div>
              </a>
              <div class="card-bottom"><span class="card-price">${formatMoney(product.price)}</span><button class="card-add" type="button" data-add-product="${escapeHtml(product.id)}" aria-label="${escapeHtml(product.name)} səbətə əlavə et" ${product.stock <= 0 ? "disabled" : ""}>+</button></div>
            </article>`).join("")}</div>
        </section>`).join("");
  }

  async function renderProductDetail() {
    const productId = new URLSearchParams(window.location.search).get("id");
    const product = database.products.find((item) => item.id === productId);
    const container = byId("product-detail");
    lowStockProductIds = new Set(database.products.filter((item) => Number(item.stock) < 5).map((item) => item.id));
    if (!product) {
      container.innerHTML = `<div class="empty-state"><strong>Məhsul tapılmadı</strong><a class="button button-dark" href="/index.html">Mağazaya qayıt</a></div>`;
      return;
    }
    const max = Math.max(0, Number(product.stock));
    container.innerHTML = `
      <a class="back-link" href="/index.html#catalog">← Bütün məhsullar</a>
      <div class="product-detail-layout">
        <div class="product-detail-visual" style="--product-soft:${safeColor(product.color)}22">${productImage(product)}${lowStockProductIds.has(product.id) ? stockLabel(product) : ""}</div>
        <div class="product-detail-info">
          <span class="product-category">${escapeHtml(product.category)}</span>
          <h1>${escapeHtml(product.name)}</h1>
          <p class="product-detail-price">${formatMoney(product.price)}</p>
          <p class="product-detail-description">${escapeHtml(product.name)} — ZalaStore-un ${escapeHtml(product.category.toLocaleLowerCase("az"))} kolleksiyasından seçilmiş məhsuldur.</p>
          <dl class="product-specs">
            <div><dt>Kateqoriya</dt><dd>${escapeHtml(product.category)}</dd></div>
            <div><dt>SKU</dt><dd>${escapeHtml(product.sku)}</dd></div>
            <div><dt>Mövcud stok</dt><dd>${max > 0 ? `${max} ədəd` : "Stokda yoxdur"}</dd></div>
          </dl>
          <div class="product-detail-buy">
            <label for="product-detail-qty">Say</label>
            <div class="quantity-control"><button type="button" data-qty-step="-1" aria-label="Sayı azalt" ${max <= 0 ? "disabled" : ""}>−</button><input id="product-detail-qty" type="number" min="1" max="${max}" value="1" ${max <= 0 ? "disabled" : ""}><button type="button" data-qty-step="1" aria-label="Sayı artır" ${max <= 0 ? "disabled" : ""}>＋</button></div>
          </div>
          <div class="preview-total"><span>Yekun qiymət</span><strong id="product-detail-total">${formatMoney(product.price)}</strong></div>
          <button id="product-detail-add" class="button button-dark button-full" type="button" data-add-product="${escapeHtml(product.id)}" ${max <= 0 ? "disabled" : ""}>Səbətə əlavə et <span aria-hidden="true">→</span></button>
        </div>
      </div>`;
    document.title = `${product.name} — ZalaStore`;
    refreshProductDetailTotal(product);
  }

  async function refreshProductDetailTotal(product) {
    const input = byId("product-detail-qty");
    const total = byId("product-detail-total");
    const button = byId("product-detail-add");
    if (!product || !input || !total || !button) return;
    const quantity = Number(input.value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > Number(product.stock)) {
      total.textContent = "—";
      button.disabled = true;
      return;
    }
    try {
      const preview = await apiRequest("/api/cart/preview", "POST", {
        products: database.products,
        cart: [{ productId: product.id, quantity }]
      });
      total.textContent = formatMoney(preview.subtotal);
      button.disabled = false;
    } catch (error) {
      total.textContent = "—";
      button.disabled = true;
    }
  }

  function getCart() {
    const user = currentUser();
    if (!user || user.role !== "CUSTOMER") return [];
    return database.carts[user.id] || [];
  }

  async function updateCartCount() {
    const user = currentUser();
    const cart = getCart();
    if (!user || user.role !== "CUSTOMER" || !cart.length) {
      byId("cart-count").textContent = "0";
      return;
    }
    try {
      const preview = await apiRequest("/api/cart/preview", "POST", { products: database.products, cart });
      byId("cart-count").textContent = String(preview.quantity);
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function addToCart(productId, quantity = 1) {
    const user = currentUser();
    if (!user || user.role !== "CUSTOMER") {
      showToast("Alış-veriş etmək üçün müştəri hesabına daxil ol.", true);
      setAuthMode("login");
      showView("auth");
      return;
    }
    const product = database.products.find((item) => item.id === productId);
    if (!product) {
      showToast("Məhsul tapılmadı.", true);
      return;
    }
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1) {
      showToast("Məhsul sayı ən azı 1 olmalıdır.", true);
      return;
    }
    try {
      const result = await apiRequest("/api/cart/update", "POST", {
        actor: user,
        products: database.products,
        cart: getCart(),
        action: "ADD",
        productId,
        quantity: amount
      });
      database.carts[user.id] = result.cart;
      saveDatabase();
    } catch (error) {
      showToast(error.message, true);
      return;
    }
    updateCartCount();
    showToast(`${product.name} səbətə əlavə edildi.`);
  }

  async function renderCart() {
    const user = currentUser();
    if (!user) return;
    const cart = getCart();
    const container = byId("cart-content");
    if (!cart.length) {
      container.innerHTML = `<div class="empty-state"><strong>Səbətin hələ boşdur</strong>Bəyəndiyin məhsullara bax və alış-verişə başla.<br><button class="button button-dark" style="margin-top:16px" data-view="store">Mağazaya qayıt</button></div>`;
      return;
    }
    let preview;
    try {
      preview = await apiRequest("/api/cart/preview", "POST", { products: database.products, cart });
    } catch (error) {
      container.innerHTML = `<div class="notice notice-warning">${escapeHtml(error.message)}</div>`;
      showToast(error.message, true);
      return;
    }
    const lines = preview.items;
    const total = preview.subtotal;
    const count = preview.quantity;
    container.innerHTML = `
      <div class="cart-layout">
        <div class="cart-list">${lines.map(({ quantity, product, lineTotal }) => `
          <div class="cart-item" style="--product-soft:${safeColor(product.color)}22">
            <div class="cart-thumb">${productImage(product)}</div>
            <div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.sku)} · ${formatMoney(product.price)}</p><button class="remove-link" type="button" data-remove-cart="${escapeHtml(product.id)}">Səbətdən sil</button></div>
            <div class="quantity-control"><button type="button" data-cart-step="-1" data-product-id="${escapeHtml(product.id)}" aria-label="Sayı azalt">−</button><input type="number" min="1" max="${Number(product.stock)}" value="${Number(quantity)}" data-cart-quantity="${escapeHtml(product.id)}" aria-label="${escapeHtml(product.name)} sayı"><button type="button" data-cart-step="1" data-product-id="${escapeHtml(product.id)}" aria-label="Sayı artır">＋</button></div>
            <div class="cart-line-price">${formatMoney(lineTotal)}</div>
          </div>`).join("")}</div>
        <aside class="summary-card"><h2>Sifariş xülasəsi</h2><div class="summary-row"><span>Məhsullar (${count} ədəd)</span><span>${formatMoney(total)}</span></div><div class="summary-row"><span>Çatdırılma</span><span>Pulsuz</span></div><div class="summary-row total"><span>Yekun məbləğ</span><span>${formatMoney(total)}</span></div><button id="checkout-button" class="button button-dark">Sifarişi tamamla <span aria-hidden="true">→</span></button><p style="margin:12px 0 0;color:#92948c;font-size:9px;line-height:1.6">Demo sifarişidir. Ödəniş inteqrasiyası yoxdur; tamamlanan sifariş satış kimi qeydə alınacaq.</p></aside>
      </div>`;
  }

  async function changeCartQuantity(productId, quantity) {
    const user = currentUser();
    const product = database.products.find((item) => item.id === productId);
    const amount = Number(quantity);
    if (!user || !product) return;
    try {
      const result = await apiRequest("/api/cart/update", "POST", {
        actor: user,
        products: database.products,
        cart: getCart(),
        action: "SET",
        productId,
        quantity: amount
      });
      database.carts[user.id] = result.cart;
      saveDatabase();
    } catch (error) {
      showToast(error.message, true);
      renderCart();
      return;
    }
    updateCartCount();
    renderCart();
  }

  async function removeCartItem(productId) {
    const user = currentUser();
    if (!user) return;
    try {
      const result = await apiRequest("/api/cart/update", "POST", {
        actor: user,
        products: database.products,
        cart: getCart(),
        action: "REMOVE",
        productId
      });
      database.carts[user.id] = result.cart;
      saveDatabase();
    } catch (error) {
      showToast(error.message, true);
      return;
    }
    updateCartCount();
    renderCart();
  }

  async function checkout() {
    const user = currentUser();
    const cart = getCart();
    if (!user || user.role !== "CUSTOMER") {
      showToast("Sifarişi tamamlamaq üçün müştəri hesabına daxil ol.", true);
      return;
    }
    if (!cart.length) {
      showToast("Səbət boşdur.", true);
      return;
    }

    const button = byId("checkout-button");
    button.disabled = true;
    button.textContent = "Sifariş yoxlanılır…";
    try {
      const result = await apiRequest("/api/sales/checkout", "POST", {
        customer: user,
        products: database.products,
        cart
      });
      database.products = result.products;
      database.sales.unshift(result.sale);
      database.carts[user.id] = [];
      saveDatabase();
      updateCartCount();
      showToast(`Sifariş tamamlandı — ${result.sale.id}`);
      showView("orders");
    } catch (error) {
      showToast(error.message, true);
      renderCart();
    }
  }

  async function renderCustomerOrders() {
    const user = currentUser();
    if (!user) return;
    const container = byId("customer-orders");
    let sales;
    try {
      sales = await apiRequest("/api/customers/orders", "POST", { customer: user, sales: database.sales });
    } catch (error) {
      container.innerHTML = `<div class="notice notice-warning">${escapeHtml(error.message)}</div>`;
      showToast(error.message, true);
      return;
    }
    if (!sales.length) {
      container.innerHTML = `<div class="empty-state"><strong>Hələ sifariş yoxdur</strong>İlk seçimini et və sevdiyin tərzi tap.</div>`;
      return;
    }
    container.innerHTML = sales.map((sale) => `
      <article class="order-card"><div class="order-head"><strong>${escapeHtml(sale.id)}</strong><span>${dateTime.format(new Date(sale.createdAt))}</span></div>
      <div class="order-items">${sale.items.map((item) => `${escapeHtml(item.name)} × ${Number(item.quantity)} — ${formatMoney(item.lineTotal)}`).join("<br>")}</div>
      <div class="order-total">Yekun · ${formatMoney(sale.total)}</div></article>`).join("");
  }

  function renderProfile() {
    const user = currentUser();
    if (!user || user.role !== "CUSTOMER") return;
    const form = byId("profile-form");
    form.elements.namedItem("name").value = user.name;
    form.elements.namedItem("email").value = user.email;
    form.elements.namedItem("currentPassword").value = "";
    form.elements.namedItem("newPassword").value = "";
    form.elements.namedItem("confirmPassword").value = "";
    byId("profile-error").classList.add("hidden");
    byId("profile-avatar").textContent = initials(user.name) || "ZS";
    byId("profile-display-name").textContent = user.name;
    byId("profile-display-email").textContent = user.email;
  }

  async function updateProfile(form) {
    const user = currentUser();
    if (!user || user.role !== "CUSTOMER") {
      showToast("Profil məlumatlarını yalnız müştəri dəyişə bilər.", true);
      return;
    }
    const values = new FormData(form);
    const name = String(values.get("name") || "").trim();
    const email = String(values.get("email") || "").trim().toLowerCase();
    const currentPassword = String(values.get("currentPassword") || "");
    const newPassword = String(values.get("newPassword") || "");
    const confirmPassword = String(values.get("confirmPassword") || "");
    const error = byId("profile-error");
    if (!name || !email || !currentPassword) {
      error.textContent = "Ad, e-poçt və cari şifrə sahələrini doldur.";
      error.classList.remove("hidden");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      error.textContent = "Yeni şifrə və təsdiqi eyni deyil.";
      error.classList.remove("hidden");
      return;
    }
    if (name.split(/\s+/).filter(Boolean).length < 2) {
      error.textContent = "Ad və soyad sahələrinə həm adını, həm də soyadını yaz.";
      error.classList.remove("hidden");
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Yadda saxlanılır…";
    try {
      const updated = await apiRequest(`/api/customers/${encodeURIComponent(user.id)}/profile`, "PUT", {
        account: user,
        users: database.users,
        name,
        email,
        currentPassword,
        newPassword
      });
      const index = database.users.findIndex((account) => account.id === user.id);
      if (index < 0) throw new Error("Müştəri hesabı brauzer yaddaşında tapılmadı.");
      database.users[index] = updated;
      saveDatabase();
      renderProfile();
      syncShell();
      showToast("Profil məlumatları uğurla yeniləndi.");
    } catch (requestError) {
      error.textContent = requestError.message;
      error.classList.remove("hidden");
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Dəyişiklikləri saxla <span aria-hidden="true">→</span>';
    }
  }

  function openProductForm(product = null) {
    const form = byId("product-form");
    form.reset();
    byId("product-form-title").textContent = product ? "Məhsulu redaktə et" : "Yeni məhsul";
    form.elements.id.value = product ? product.id : "";
    form.elements.name.value = product ? product.name : "";
    form.elements.sku.value = product ? product.sku : "";
    form.elements.category.value = product ? product.category : "";
    form.elements.price.value = product ? product.price : "";
    form.elements.stock.value = product ? product.stock : "";
    form.elements.color.value = safeColor(product ? product.color : "#a7b2a0");
    byId("product-form-wrap").classList.remove("hidden");
    byId("product-form-wrap").scrollIntoView({ behavior: "smooth", block: "center" });
    form.elements.name.focus();
  }

  async function renderInventory() {
    const user = currentUser();
    if (!user || !["ADMIN", "STAFF"].includes(user.role)) return;
    let inventory;
    try {
      inventory = await apiRequest("/api/admin/inventory", "POST", { actor: user, products: database.products });
    } catch (error) {
      showToast(error.message, true);
      return;
    }
    const lowStock = inventory.lowStock;
    lowStockProductIds = new Set(lowStock.map((product) => product.id));
    byId("new-product-button").classList.toggle("hidden", user.role !== "ADMIN");
    const rows = byId("inventory-rows");
    if (!inventory.products.length) {
      rows.innerHTML = `<tr><td colspan="6"><div class="empty-state">Hələ məhsul yoxdur.</div></td></tr>`;
      return;
    }
    rows.innerHTML = inventory.products.map((product) => `
      <tr>
        <td><div class="table-product" style="--product-soft:${safeColor(product.color)}22"><div class="table-thumb">${productImage(product)}</div><strong>${escapeHtml(product.name)}</strong></div></td>
        <td>${escapeHtml(product.sku)}</td><td>${escapeHtml(product.category)}</td><td>${formatMoney(product.price)}</td>
        <td class="stock-cell${lowStockProductIds.has(product.id) ? " low" : ""}">${Number(product.stock)}${lowStockProductIds.has(product.id) ? " · Az stok" : ""}</td>
        <td>${user.role === "ADMIN" ? `<div class="table-actions"><button class="small-button" data-edit-product="${escapeHtml(product.id)}">Redaktə</button><button class="small-button danger" data-delete-product="${escapeHtml(product.id)}">Sil</button></div>` : `<span style="color:#888;font-size:10px">Yalnız baxış</span>`}</td>
      </tr>`).join("");
  }

  async function submitProduct(form) {
    const user = currentUser();
    if (!user || user.role !== "ADMIN") {
      showToast("Məhsulları yalnız admin idarə edə bilər.", true);
      return;
    }
    const values = new FormData(form);
    const id = String(values.get("id") || "");
    const name = String(values.get("name") || "").trim();
    const sku = String(values.get("sku") || "").trim().toUpperCase();
    const category = String(values.get("category") || "").trim();
    const price = Number(values.get("price"));
    const stock = Number(values.get("stock"));
    const color = safeColor(String(values.get("color") || ""));
    const original = database.products.find((product) => product.id === id);
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const saved = await apiRequest(id ? `/api/products/${encodeURIComponent(id)}` : "/api/products", id ? "PUT" : "POST", {
        actor: user,
        products: database.products,
        product: {
          id: id || "",
          name,
          sku,
          category,
          price,
          stock,
          color
        },
        originalId: id || null
      });
      if (original) {
        database.products = database.products.map((product) => product.id === saved.id ? saved : product);
        showToast("Məhsul məlumatları yeniləndi.");
      } else {
        database.products.unshift(saved);
        showToast("Yeni məhsul əlavə edildi.");
      }
      saveDatabase();
      byId("product-form-wrap").classList.add("hidden");
      renderInventory();
      renderStore();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      submit.disabled = false;
    }
  }

  async function deleteProduct(productId) {
    const product = database.products.find((item) => item.id === productId);
    if (!product) {
      showToast("Məhsul tapılmadı.", true);
      return;
    }
    if (!window.confirm(`“${product.name}” məhsulunu silmək istədiyinə əminsən?`)) return;
    try {
      await apiRequest(`/api/products/${encodeURIComponent(productId)}`, "DELETE", {
        actor: currentUser(),
        product,
        sales: database.sales
      });
      database.products = database.products.filter((item) => item.id !== productId);
      Object.keys(database.carts).forEach((userId) => {
        database.carts[userId] = database.carts[userId].filter((line) => line.productId !== productId);
      });
      saveDatabase();
      renderInventory();
      renderStore();
      showToast("Məhsul silindi.");
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function statMarkup(label, value) {
    return `<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  async function renderDashboard() {
    const actor = currentUser();
    if (!actor || actor.role !== "ADMIN") return;
    try {
      const data = await apiRequest("/api/admin/dashboard", "POST", {
        actor,
        products: database.products,
        users: database.users,
        sales: database.sales
      });
      lowStockProductIds = new Set(data.lowStock.map((product) => product.id));
      byId("dashboard-stats").innerHTML =
        statMarkup("Ümumi satış", formatMoney(data.revenue)) +
        statMarkup("Sifariş sayı", String(data.saleCount)) +
        statMarkup("Məhsul çeşidi", String(data.productCount)) +
        statMarkup("Müştərilər", String(data.customerCount)) +
        statMarkup("İşçilər", String(data.staffCount)) +
        statMarkup("Az stoklu məhsul", String(data.lowStockCount));
      renderTopProducts(byId("dashboard-top-products"), data.topProducts);
      byId("dashboard-low-stock").innerHTML = data.lowStock.length
        ? data.lowStock.map((product) => `<div class="report-sale"><strong>${escapeHtml(product.name)} <b>${Number(product.stock)} əd.</b></strong><span>${escapeHtml(product.sku)} · ${escapeHtml(product.category)}</span></div>`).join("")
        : `<div class="empty-state">Azalan stokda məhsul yoxdur.</div>`;
      byId("dashboard-recent-sales").innerHTML = data.recentSales.length
        ? data.recentSales.map((sale) => `<div class="report-sale"><strong>${escapeHtml(sale.id)} <b>${formatMoney(sale.total)}</b></strong><span>${dateTime.format(new Date(sale.createdAt))} · ${escapeHtml(sale.customerName)} · ${sale.items.reduce((sum, item) => sum + Number(item.quantity), 0)} ədəd</span></div>`).join("")
        : `<div class="empty-state">Hələ satış qeydə alınmayıb.</div>`;
    } catch (error) {
      byId("dashboard-stats").innerHTML = `<div class="notice notice-warning">${escapeHtml(error.message)}</div>`;
      showToast(error.message, true);
    }
  }

  function renderTopProducts(chart, products) {
    if (!products.length) {
      chart.innerHTML = `<div class="empty-state">Satış olduqdan sonra ən çox satılan məhsullar burada görünəcək.</div>`;
      return;
    }
    const max = Math.max(...products.map((product) => product.quantity));
    chart.innerHTML = products.map((product) => `
      <div class="bar-item"><span class="bar-name" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, product.quantity / max * 100)}%"></div></div><span class="bar-value">${product.quantity} əd. · ${formatMoney(product.revenue)}</span></div>`).join("");
  }

  async function renderSales() {
    const from = byId("sales-from").value;
    const to = byId("sales-to").value;
    try {
      const result = await apiRequest("/api/sales/filter", "POST", { actor: currentUser(), sales: database.sales, from, to });
      currentFilteredSales = result.sales;
      byId("sales-summary").innerHTML = statMarkup("Satış sayı", String(result.orderCount)) + statMarkup("Ümumi məbləğ", formatMoney(result.revenue)) + statMarkup("Orta sifariş", formatMoney(result.averageOrder));
      const rows = byId("sales-rows");
      if (!result.sales.length) {
      rows.innerHTML = `<tr><td colspan="6"><div class="empty-state">Bu tarix aralığında satış tapılmadı.</div></td></tr>`;
      return;
      }
      rows.innerHTML = result.sales.map((sale) => `
        <tr>
          <td><strong>${escapeHtml(sale.id)}</strong></td><td>${dateTime.format(new Date(sale.createdAt))}</td>
          <td>${escapeHtml(sale.customerName)}<br><span style="color:#9a9c94">${escapeHtml(sale.customerEmail)}</span></td>
          <td>${sale.items.reduce((sum, item) => sum + Number(item.quantity), 0)}</td><td><strong>${formatMoney(sale.total)}</strong></td>
          <td><button class="small-button" data-sale-detail="${escapeHtml(sale.id)}">Detallara bax</button></td>
        </tr>
        <tr id="sale-detail-${escapeHtml(sale.id)}" class="hidden"><td colspan="6"><div class="row-detail">${sale.items.map((item) => `<div class="row-detail-line"><span>${escapeHtml(item.name)} · ${escapeHtml(item.sku)} × ${Number(item.quantity)}</span><strong>${formatMoney(item.lineTotal)}</strong></div>`).join("")}<div class="row-detail-line"><strong>Status: Tamamlandı</strong><strong>Yekun: ${formatMoney(sale.total)}</strong></div></div></td></tr>`).join("");
    } catch (error) {
      currentFilteredSales = [];
      byId("sales-rows").innerHTML = `<tr><td colspan="6"><div class="empty-state">${escapeHtml(error.message)}</div></td></tr>`;
      showToast(error.message, true);
    }
  }

  async function renderReports() {
    const selectedDate = byId("report-date").value || localDateValue(new Date());
    try {
      const report = await apiRequest("/api/reports", "POST", {
        actor: currentUser(),
        sales: database.sales,
        period: reportPeriod,
        date: selectedDate
      });
      currentReportSales = report.sales;
      byId("report-stats").innerHTML = statMarkup("Satış məbləği", formatMoney(report.revenue)) + statMarkup("Sifariş sayı", String(report.orderCount)) + statMarkup("Satılan məhsul", `${report.unitCount} ədəd`);

      const chart = byId("top-products-chart");
      renderTopProducts(chart, report.topProducts);
    const detail = byId("report-sales");
      detail.innerHTML = report.sales.length ? report.sales.map((sale) => `
      <div class="report-sale"><strong>${escapeHtml(sale.id)} <b>${formatMoney(sale.total)}</b></strong><span>${dateTime.format(new Date(sale.createdAt))} · ${escapeHtml(sale.customerName)} · ${sale.items.length} məhsul növü</span></div>`).join("") : `<div class="empty-state">Seçilmiş dövrdə satış yoxdur.</div>`;
    } catch (error) {
      byId("top-products-chart").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
      byId("report-sales").innerHTML = "";
      showToast(error.message, true);
    }
  }

  async function downloadCsv(sales, filename) {
    try {
      const csv = await apiCsvRequest("/api/sales/export", { actor: currentUser(), sales });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast(`${sales.length} satış CSV faylına ixrac edildi.`);
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function renderUsers() {
    const user = currentUser();
    if (!user || user.role !== "ADMIN") return;
    let users;
    try {
      users = await apiRequest("/api/admin/users", "POST", { actor: user, users: database.users });
    } catch (error) {
      byId("user-rows").innerHTML = `<tr><td colspan="5"><div class="empty-state">${escapeHtml(error.message)}</div></td></tr>`;
      showToast(error.message, true);
      return;
    }
    byId("user-rows").innerHTML = users.map((account) => `
      <tr><td><div class="table-product"><div class="user-avatar">${escapeHtml(initials(account.name))}</div><strong>${escapeHtml(account.name)}</strong></div></td><td>${escapeHtml(account.email)}</td><td><span class="role-badge role-${escapeHtml(account.role.toLowerCase())}">${roleName(account.role)}</span></td><td>${dateOnly.format(new Date(account.createdAt))}</td><td>${account.role === "CUSTOMER" ? `<button class="small-button" data-edit-customer="${escapeHtml(account.id)}">Müştərini redaktə et</button>` : `<span style="color:#999;font-size:10px">—</span>`}</td></tr>`).join("");
  }

  function openCustomerForm(customer) {
    const form = byId("customer-form");
    form.reset();
    form.elements.namedItem("id").value = customer.id;
    form.elements.namedItem("name").value = customer.name;
    form.elements.namedItem("email").value = customer.email;
    byId("customer-form-wrap").classList.remove("hidden");
    byId("customer-form-wrap").scrollIntoView({ behavior: "smooth", block: "center" });
    form.elements.namedItem("name").focus();
  }

  async function updateCustomerFromAdmin(form) {
    const actor = currentUser();
    if (!actor || actor.role !== "ADMIN") {
      showToast("Müştəri məlumatlarını yalnız admin dəyişə bilər.", true);
      return;
    }
    const values = new FormData(form);
    const id = String(values.get("id") || "");
    const customer = database.users.find((account) => account.id === id && account.role === "CUSTOMER");
    if (!customer) {
      showToast("Müştəri hesabı tapılmadı.", true);
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const updated = await apiRequest(`/api/admin/customers/${encodeURIComponent(id)}`, "PUT", {
        actor,
        users: database.users,
        customer,
        name: String(values.get("name") || "").trim(),
        email: String(values.get("email") || "").trim().toLowerCase(),
        newPassword: String(values.get("password") || "")
      });
      const index = database.users.findIndex((account) => account.id === updated.id);
      database.users[index] = updated;
      saveDatabase();
      byId("customer-form-wrap").classList.add("hidden");
      renderUsers();
      showToast("Müştəri hesabı yeniləndi.");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      submit.disabled = false;
    }
  }

  function setAuthMode(mode, resetForm = true) {
    authMode = mode;
    byId("auth-title").textContent = mode === "login" ? "Yenidən xoş gəldin" : "Hesabını yarat";
    byId("auth-subtitle").textContent = mode === "login" ? "Davam etmək üçün hesabına daxil ol." : "ZalaStore-da alış-verişə başlamaq üçün qeydiyyatdan keç.";
    byId("auth-name-wrap").classList.toggle("hidden", mode !== "register");
    const nameInput = byId("auth-name-wrap").querySelector("input");
    nameInput.required = mode === "register";
    nameInput.pattern = mode === "register" ? "\\S+\\s+\\S+" : "";
    nameInput.title = mode === "register" ? "Ad və soyadınızı daxil edin" : "";
    byId("auth-form").elements.namedItem("password").autocomplete = mode === "login" ? "current-password" : "new-password";
    byId("auth-submit").innerHTML = mode === "login" ? 'Daxil ol <span aria-hidden="true">→</span>' : 'Hesab yarat <span aria-hidden="true">→</span>';
    byId("demo-credentials").classList.toggle("hidden", mode !== "login");
    document.querySelectorAll("[data-auth-mode]").forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
    byId("auth-error").classList.add("hidden");
    if (resetForm) byId("auth-form").reset();
  }

  async function submitAuth(form) {
    if (!database) {
      const error = byId("auth-error");
      error.textContent = "Məlumatlar yüklənir. Bir az sonra yenidən cəhd et.";
      error.classList.remove("hidden");
      return;
    }
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const error = byId("auth-error");
    const submit = byId("auth-submit");
    submit.disabled = true;
    submit.textContent = "Yoxlanılır…";
    error.classList.add("hidden");
    try {
      let user;
      if (authMode === "login") {
        user = await apiRequest("/api/auth/login", "POST", { email, password, users: database.users });
        const index = database.users.findIndex((account) => account.id === user.id);
        if (index >= 0) database.users[index] = user;
      } else {
        const name = String(formData.get("name") || "").trim();
        if (name.split(/\s+/).filter(Boolean).length < 2) {
          throw new Error("Qeydiyyat üçün ad və soyadını daxil et.");
        }
        user = await apiRequest("/api/customers/register", "POST", {
          name,
          email,
          password,
          users: database.users
        });
        database.users.push(user);
      }
      saveDatabase();
      setSession(user);
      setAuthMode("login");
      showToast(`Xoş gəldin, ${user.name}!`);
      showView(user.role === "CUSTOMER" ? "store" : "inventory");
    } catch (requestError) {
      error.textContent = requestError.message;
      error.classList.remove("hidden");
    } finally {
      submit.disabled = false;
      submit.innerHTML = authMode === "login" ? 'Daxil ol <span aria-hidden="true">→</span>' : 'Hesab yarat <span aria-hidden="true">→</span>';
    }
  }

  async function createStaff(form) {
    const user = currentUser();
    if (!user || user.role !== "ADMIN") {
      showToast("İşçi hesabını yalnız admin yarada bilər.", true);
      return;
    }
    const values = new FormData(form);
    const name = String(values.get("name") || "").trim();
    const email = String(values.get("email") || "").trim().toLowerCase();
    const password = String(values.get("password") || "");
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const staff = await apiRequest("/api/admin/staff", "POST", {
        actor: user,
        users: database.users,
        name,
        email,
        password
      });
      database.users.push(staff);
      saveDatabase();
      form.reset();
      renderUsers();
      showToast("İşçi hesabı yaradıldı.");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      submit.disabled = false;
    }
  }

  function onDocumentClick(event) {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      event.preventDefault();
      showView(viewButton.dataset.view);
      return;
    }
    const categoryShortcut = event.target.closest("[data-category-shortcut]");
    if (categoryShortcut) {
      event.preventDefault();
      const categoryFilter = byId("category-filter");
      categoryFilter.value = categoryShortcut.dataset.categoryShortcut;
      renderStore();
      byId("catalog").scrollIntoView({ behavior: "smooth" });
      return;
    }
    const authModeButton = event.target.closest("#auth-toggle [data-auth-mode]");
    if (authModeButton) {
      setAuthMode(authModeButton.dataset.authMode);
      return;
    }
    const addButton = event.target.closest("[data-add-product]");
    if (addButton) {
      event.stopPropagation();
      const quantityInput = byId("product-detail-qty");
      const quantity = addButton.id === "product-detail-add" && quantityInput ? Number(quantityInput.value) : 1;
      addToCart(addButton.dataset.addProduct, quantity);
      return;
    }
    const qtyStep = event.target.closest("[data-qty-step]");
    if (qtyStep) {
      const input = byId("product-detail-qty");
      if (!input) return;
      input.value = String(Math.max(1, Math.min(Number(input.max), Number(input.value || 1) + Number(qtyStep.dataset.qtyStep))));
      refreshProductDetailTotal(database.products.find((item) => item.id === new URLSearchParams(window.location.search).get("id")));
      return;
    }
    const cartStep = event.target.closest("[data-cart-step]");
    if (cartStep) {
      const input = document.querySelector(`[data-cart-quantity="${CSS.escape(cartStep.dataset.productId)}"]`);
      if (!input) return;
      changeCartQuantity(cartStep.dataset.productId, Number(input.value) + Number(cartStep.dataset.cartStep));
      return;
    }
    const removeButton = event.target.closest("[data-remove-cart]");
    if (removeButton) {
      removeCartItem(removeButton.dataset.removeCart);
      return;
    }
    const detailButton = event.target.closest("[data-sale-detail]");
    if (detailButton) {
      const row = byId(`sale-detail-${detailButton.dataset.saleDetail}`);
      if (row) row.classList.toggle("hidden");
      return;
    }
    const editButton = event.target.closest("[data-edit-product]");
    if (editButton) {
      const product = database.products.find((item) => item.id === editButton.dataset.editProduct);
      if (product) openProductForm(product);
      return;
    }
    const editCustomerButton = event.target.closest("[data-edit-customer]");
    if (editCustomerButton) {
      const customer = database.users.find((account) => account.id === editCustomerButton.dataset.editCustomer);
      if (customer) openCustomerForm(customer);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-product]");
    if (deleteButton) {
      deleteProduct(deleteButton.dataset.deleteProduct);
      return;
    }
    const periodButton = event.target.closest("[data-period]");
    if (periodButton) {
      reportPeriod = periodButton.dataset.period;
      document.querySelectorAll("[data-period]").forEach((button) => button.classList.toggle("active", button === periodButton));
      renderReports();
      return;
    }
    if (event.target.id === "logout-button") {
      setSession(null);
      showView("store");
      showToast("Hesabdan çıxış edildi.");
      return;
    }
    if (event.target.id === "theme-toggle") {
      toggleTheme();
      return;
    }
    if (event.target.id === "new-product-button") {
      openProductForm();
      return;
    }
    if (event.target.id === "product-form-close" || event.target.id === "product-cancel") {
      byId("product-form-wrap").classList.add("hidden");
      byId("product-form").reset();
      return;
    }
    if (event.target.id === "customer-form-close" || event.target.id === "customer-form-cancel") {
      byId("customer-form-wrap").classList.add("hidden");
      byId("customer-form").reset();
      return;
    }
    if (event.target.id === "checkout-button") checkout();
    if (event.target.id === "sales-filter") renderSales();
    if (event.target.id === "sales-clear") {
      byId("sales-from").value = "";
      byId("sales-to").value = "";
      renderSales();
    }
    if (event.target.id === "sales-export") downloadCsv(currentFilteredSales, `zalastore-satislar-${localDateValue(new Date())}.csv`);
    if (event.target.id === "report-export") {
      downloadCsv(currentReportSales, `zalastore-hesabat-${reportPeriod}-${byId("report-date").value || localDateValue(new Date())}.csv`);
    }
  }

  function onDocumentChange(event) {
    if (event.target.matches("[data-cart-quantity]")) {
      changeCartQuantity(event.target.dataset.cartQuantity, Number(event.target.value));
      return;
    }
    if (event.target.id === "product-search" || event.target.id === "category-filter") {
      renderStore();
      return;
    }
    if (event.target.id === "report-date") renderReports();
  }

  function wireEvents() {
    const bind = (id, eventName, handler) => {
      const element = byId(id);
      if (element) element.addEventListener(eventName, handler);
    };
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("change", onDocumentChange);
    bind("product-search", "input", renderStore);
    bind("product-detail", "input", (event) => {
      if (event.target.id !== "product-detail-qty") return;
      refreshProductDetailTotal(database.products.find((item) => item.id === new URLSearchParams(window.location.search).get("id")));
    });
    bind("auth-form", "submit", (event) => {
      event.preventDefault();
      submitAuth(event.currentTarget);
    });
    bind("product-form", "submit", (event) => {
      event.preventDefault();
      submitProduct(event.currentTarget);
    });
    bind("staff-form", "submit", (event) => {
      event.preventDefault();
      createStaff(event.currentTarget);
    });
    bind("profile-form", "submit", (event) => {
      event.preventDefault();
      updateProfile(event.currentTarget);
    });
    bind("customer-form", "submit", (event) => {
      event.preventDefault();
      updateCustomerFromAdmin(event.currentTarget);
    });
  }

  async function start() {
    if (byId("footer-year")) byId("footer-year").textContent = String(new Date().getFullYear());
    initializeTheme();
    if (currentView === "auth") {
      const mode = document.querySelector("main")?.dataset.authMode;
      setAuthMode(mode === "register" ? "register" : "login", false);
    }
    wireEvents();
    try {
      await loadDatabase();
    } catch (error) {
      console.error(error);
      document.querySelector("main").innerHTML = `<section class="page-view"><div class="notice notice-warning"><strong>ZalaStore açıla bilmədi.</strong> ${escapeHtml(error.message)}. Brauzer yaddaşında problem varsa, tətbiqin localStorage məlumatlarını təmizlə.</div></section>`;
      return;
    }
    if (byId("report-date")) byId("report-date").value = localDateValue(new Date());
    if (byId("sales-from")) byId("sales-from").max = localDateValue(new Date());
    try {
      const access = await apiRequest("/api/access", "POST", { actor: currentUser(), page: currentView });
      allowedPages = access.allowedPages;
      if (!access.allowed) {
        window.location.replace(`/${currentUser() ? PAGE_FILES.store : PAGE_FILES.auth}`);
        return;
      }
      syncShell();
    } catch (error) {
      document.querySelector("main").innerHTML = `<section class="page-view"><div class="notice notice-warning"><strong>Səhifə icazəsini yoxlamaq mümkün olmadı.</strong> ${escapeHtml(error.message)}</div></section>`;
      return;
    }
    if (currentView === "auth") {
      return;
    } else if (currentView === "store") renderStore();
    else if (currentView === "product") renderProductDetail();
    else if (currentView === "cart") renderCart();
    else if (currentView === "orders") renderCustomerOrders();
    else if (currentView === "profile") renderProfile();
    else if (currentView === "inventory") renderInventory();
    else if (currentView === "dashboard") renderDashboard();
    else if (currentView === "sales") renderSales();
    else if (currentView === "reports") renderReports();
    else if (currentView === "users") renderUsers();
  }

  start();
})();
