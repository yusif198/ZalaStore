(() => {
  "use strict";

  const LOW_STOCK_THRESHOLD = 5;
  const PASSWORD_ITERATIONS = 120000;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const STORE_ZONE = "Asia/Baku";
  const seed = {
    products: [
      { id: "p-001", name: "Kətan oversize köynək", sku: "ZL-SH-001", category: "Köynək", price: 48, stock: 12, color: "#c9bda8" },
      { id: "p-002", name: "Klassik bej trençkot", sku: "ZL-OT-002", category: "Gödəkçə", price: 129, stock: 4, color: "#b89878" },
      { id: "p-003", name: "Gündəlik denim cins", sku: "ZL-TR-003", category: "Şalvar", price: 76, stock: 18, color: "#68798b" },
      { id: "p-004", name: "Minimal midi don", sku: "ZL-DR-004", category: "Don", price: 94, stock: 3, color: "#a57e76" },
      { id: "p-005", name: "Yumşaq toxunma sviter", sku: "ZL-KN-005", category: "Sviter", price: 68, stock: 9, color: "#9ba492" },
      { id: "p-006", name: "Dəri çiyin çantası", sku: "ZL-AC-006", category: "Aksesuar", price: 85, stock: 7, color: "#9a6f54" },
      { id: "p-007", name: "Yüngül bomber gödəkçə", sku: "ZL-OT-007", category: "Gödəkçə", price: 112, stock: 2, color: "#707b6e" },
      { id: "p-008", name: "Rahat pambıq futbolka", sku: "ZL-SH-008", category: "Köynək", price: 35, stock: 22, color: "#d7d2c6" },
      { id: "p-009", name: "Düz kəsim şalvar", sku: "ZL-TR-009", category: "Şalvar", price: 72, stock: 11, color: "#77766c" },
      { id: "p-010", name: "Yumşaq yun şərf", sku: "ZL-AC-010", category: "Aksesuar", price: 29, stock: 5, color: "#bd806b" },
      { id: "p-011", name: "Atlas yay donu", sku: "ZL-DR-011", category: "Don", price: 118, stock: 6, color: "#9a9b9d" },
      { id: "p-012", name: "Klassik polo köynək", sku: "ZL-SH-012", category: "Köynək", price: 52, stock: 14, color: "#597471" }
    ],
    users: [{
      id: "u-admin",
      name: "ZalaStore Admin",
      email: "admin@zalastore.az",
      password: "admin123",
      role: "ADMIN",
      createdAt: "2026-01-01T00:00:00+04:00"
    }]
  };

  function fail(status, message) {
    const error = new Error(message);
    error.status = status;
    error.detail = message;
    throw error;
  }

  const safeList = (value) => Array.isArray(value) ? value : [];
  const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
  const money = (value) => Number(Number(value).toFixed(2));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const requiredText = (value, message) => {
    const text = String(value || "").trim();
    if (!text || text.length > 120) fail(400, message);
    return text;
  };
  const requireFullName = (value) => {
    const name = requiredText(value, "Ad və soyad tələb olunur.");
    if (name.split(/\s+/).length < 2) fail(400, "Ad və soyad sahələrinə həm ad, həm də soyad yazılmalıdır.");
    return name;
  };
  const validateEmail = (value) => {
    const email = normalizeEmail(value);
    if (email.length > 120 || !EMAIL_PATTERN.test(email)) fail(400, "Düzgün e-poçt ünvanı daxil et.");
    return email;
  };
  const validatePassword = (value) => {
    if (typeof value !== "string" || value.length < 6 || value.length > 128) {
      fail(400, "Şifrə 6–128 simvol arasında olmalıdır.");
    }
    return value;
  };
  const requireRole = (actor, role) => {
    if (!actor || actor.role !== role) fail(403, "Bu əməliyyat üçün icazən yoxdur.");
  };
  const id = () => `u-${crypto.randomUUID()}`;

  function secureRandom(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
  const fromBase64 = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

  async function encodePassword(password) {
    const salt = secureRandom(16);
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS },
      material,
      256
    );
    return `pbkdf2$${PASSWORD_ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
  }

  async function passwordMatches(rawPassword, storedPassword) {
    if (typeof rawPassword !== "string" || typeof storedPassword !== "string") return false;
    if (!storedPassword.startsWith("pbkdf2$")) return rawPassword === storedPassword;
    try {
      const [, iterationText, saltText, expectedText] = storedPassword.split("$");
      const iterations = Number(iterationText);
      if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 1000000) return false;
      const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(rawPassword), "PBKDF2", false, ["deriveBits"]);
      const result = await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltText), iterations },
        material,
        256
      );
      const actual = new Uint8Array(result);
      const expected = fromBase64(expectedText);
      return actual.length === expected.length && actual.every((byte, index) => byte === expected[index]);
    } catch (error) {
      return false;
    }
  }

  function pageAccess({ actor, page }) {
    const pages = {
      CUSTOMER: ["store", "cart", "orders", "profile", "product", "auth"],
      STAFF: ["store", "inventory", "sales", "product", "auth"],
      ADMIN: ["store", "inventory", "dashboard", "sales", "reports", "users", "product", "auth"]
    };
    const allowedPages = pages[actor?.role] || ["store", "product", "auth"];
    return { allowed: allowedPages.includes(page), allowedPages };
  }

  function catalog({ products, search, category }) {
    const all = safeList(products);
    const query = String(search || "").trim().toLocaleLowerCase();
    const selectedCategory = String(category || "").trim();
    const categories = [...new Set(all.map((product) => product.category))].sort((a, b) => a.localeCompare(b));
    return {
      products: all.filter((product) =>
        (!selectedCategory || product.category === selectedCategory) &&
        (!query || `${product.name} ${product.sku} ${product.category}`.toLocaleLowerCase().includes(query))),
      categories,
      lowStock: all.filter((product) => product.stock < LOW_STOCK_THRESHOLD)
    };
  }

  function previewCart({ products, cart }) {
    const byId = new Map();
    for (const product of safeList(products)) {
      if (!product.id || byId.has(product.id)) fail(400, "Məhsul siyahısı etibarsızdır.");
      byId.set(product.id, product);
    }
    const seen = new Set();
    let quantity = 0;
    let subtotal = 0;
    const items = safeList(cart).map((line) => {
      if (!line?.productId || !Number.isInteger(line.quantity) || line.quantity < 1 || seen.has(line.productId)) {
        fail(400, "Səbətdə etibarsız məhsul sayı var.");
      }
      seen.add(line.productId);
      const product = byId.get(line.productId);
      if (!product) fail(404, "Səbətdə olan məhsul tapılmadı.");
      if (line.quantity > product.stock) fail(409, `${product.name}: stokda yalnız ${product.stock} ədəd qalıb.`);
      const lineTotal = money(product.price * line.quantity);
      quantity += line.quantity;
      subtotal += lineTotal;
      return { product, quantity: line.quantity, lineTotal };
    });
    return { items, subtotal: money(subtotal), quantity };
  }

  function updateCart(request) {
    const { actor, products, cart, productId, quantity } = request;
    if (!actor || actor.role !== "CUSTOMER") fail(403, "Səbətdən istifadə üçün müştəri hesabına daxil ol.");
    if (!productId) fail(400, "Məhsul seçilməyib.");
    const updated = [...safeList(cart)];
    const index = updated.findIndex((line) => line.productId === productId);
    switch (String(request.action || "").toUpperCase()) {
      case "ADD":
        if (!Number.isInteger(quantity) || quantity < 1) fail(400, "Məhsul sayı ən azı 1 olmalıdır.");
        if (index >= 0) updated[index] = { ...updated[index], quantity: updated[index].quantity + quantity };
        else updated.push({ productId, quantity });
        break;
      case "SET":
        if (!Number.isInteger(quantity) || quantity < 1) fail(400, "Məhsul sayı ən azı 1 olmalıdır.");
        if (index < 0) fail(404, "Səbətdə olan məhsul tapılmadı.");
        updated[index] = { productId, quantity };
        break;
      case "REMOVE":
        if (index < 0) fail(404, "Səbətdə olan məhsul tapılmadı.");
        updated.splice(index, 1);
        break;
      default:
        fail(400, "Səbət əməliyyatı ADD, SET və ya REMOVE olmalıdır.");
    }
    return { cart: updated, preview: previewCart({ products, cart: updated }) };
  }

  function topProducts(sales) {
    const totals = new Map();
    for (const sale of safeList(sales)) {
      for (const item of safeList(sale.items)) {
        const old = totals.get(item.productId) || { productId: item.productId, name: item.name, quantity: 0, revenue: 0 };
        old.quantity += item.quantity;
        old.revenue = money(old.revenue + Number(item.lineTotal));
        totals.set(item.productId, old);
      }
    }
    return [...totals.values()]
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5);
  }

  function inventory({ actor, products }) {
    if (!actor || !["ADMIN", "STAFF"].includes(actor.role)) fail(403, "Stok idarəetməsinə giriş icazən yoxdur.");
    const all = safeList(products);
    return { products: all, lowStock: all.filter((product) => product.stock < LOW_STOCK_THRESHOLD) };
  }

  function dashboard({ actor, products, users, sales }) {
    requireRole(actor, "ADMIN");
    const allProducts = safeList(products);
    const allUsers = safeList(users);
    const recentSales = [...safeList(sales)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const lowStock = allProducts.filter((product) => product.stock < LOW_STOCK_THRESHOLD);
    return {
      productCount: allProducts.length,
      customerCount: allUsers.filter((user) => user.role === "CUSTOMER").length,
      staffCount: allUsers.filter((user) => user.role === "STAFF").length,
      saleCount: recentSales.length,
      lowStockCount: lowStock.length,
      revenue: money(recentSales.reduce((sum, sale) => sum + Number(sale.total), 0)),
      lowStock,
      recentSales: recentSales.slice(0, 5),
      topProducts: topProducts(recentSales)
    };
  }

  function ensureEmailAvailable(users, email, excludedId) {
    if (safeList(users).some((user) => user.id !== excludedId && normalizeEmail(user.email) === email)) {
      fail(409, "Bu e-poçtla artıq hesab mövcuddur.");
    }
  }

  async function login({ email, password, users }) {
    if (!password || !password.trim()) fail(400, "E-poçt və şifrə tələb olunur.");
    const account = safeList(users).find((user) => normalizeEmail(user.email) === normalizeEmail(email));
    if (!account || !(await passwordMatches(password, account.password))) fail(401, "E-poçt və ya şifrə yanlışdır.");
    return account.password.startsWith("pbkdf2$") ? account : { ...account, password: await encodePassword(password) };
  }

  async function register({ name, email, password, users }) {
    const cleanName = requireFullName(name);
    const cleanEmail = validateEmail(email);
    validatePassword(password);
    ensureEmailAvailable(users, cleanEmail, null);
    return {
      id: id(),
      name: cleanName,
      email: cleanEmail,
      password: await encodePassword(password),
      role: "CUSTOMER",
      createdAt: new Date().toISOString()
    };
  }

  async function updateProfile(accountId, request) {
    const { account, users, name, email, currentPassword, newPassword } = request;
    if (!account || accountId !== account.id || account.role !== "CUSTOMER") fail(403, "Müştəri hesabı ilə davam et.");
    if (!(await passwordMatches(currentPassword, account.password))) fail(401, "Cari şifrə düzgün deyil.");
    const cleanName = requireFullName(name);
    const cleanEmail = validateEmail(email);
    ensureEmailAvailable(users, cleanEmail, account.id);
    const password = newPassword ? await encodePassword(validatePassword(newPassword)) :
      (account.password.startsWith("pbkdf2$") ? account.password : await encodePassword(currentPassword));
    return { ...account, name: cleanName, email: cleanEmail, password };
  }

  async function createStaff({ actor, users, name, email, password }) {
    requireRole(actor, "ADMIN");
    const cleanName = requireFullName(name);
    const cleanEmail = validateEmail(email);
    ensureEmailAvailable(users, cleanEmail, null);
    return { id: id(), name: cleanName, email: cleanEmail, password: await encodePassword(validatePassword(password)), role: "STAFF", createdAt: new Date().toISOString() };
  }

  async function updateCustomer(customerId, request) {
    requireRole(request.actor, "ADMIN");
    const customer = request.customer;
    if (!customer || customerId !== customer.id || customer.role !== "CUSTOMER") fail(404, "Müştəri hesabı tapılmadı.");
    const name = requireFullName(request.name);
    const email = validateEmail(request.email);
    ensureEmailAvailable(request.users, email, customer.id);
    const password = request.newPassword ? await encodePassword(validatePassword(request.newPassword)) : customer.password;
    return { ...customer, name, email, password };
  }

  function saveProduct(request) {
    requireRole(request.actor, "ADMIN");
    const product = request.product;
    if (!product) fail(400, "Məhsul məlumatları tələb olunur.");
    const name = requiredText(product.name, "Məhsul adı tələb olunur.");
    const sku = requiredText(product.sku, "SKU kodu tələb olunur.").toUpperCase();
    const category = requiredText(product.category, "Kateqoriya tələb olunur.");
    if (!Number.isFinite(product.price) || product.price <= 0 || Math.round(product.price * 100) !== product.price * 100) {
      fail(400, "Qiymət müsbət olmalı və qəpik dəqiqliyini aşmamalıdır.");
    }
    if (!Number.isInteger(product.stock) || product.stock < 0) fail(400, "Stok sayı mənfi ola bilməz.");
    const products = safeList(request.products);
    const originalId = request.originalId;
    if (originalId && !products.some((item) => item.id === originalId)) fail(404, "Redaktə ediləcək məhsul tapılmadı.");
    if (products.some((item) => item.id !== originalId && item.sku.toUpperCase() === sku)) fail(409, "Bu SKU kodu artıq istifadə olunur.");
    return { id: originalId || `p-${crypto.randomUUID()}`, name, sku, category, price: money(product.price), stock: product.stock, color: /^#[0-9a-f]{6}$/i.test(product.color || "") ? product.color : "#a7b2a0" };
  }

  function deleteProduct(request) {
    requireRole(request.actor, "ADMIN");
    if (!request.product) fail(400, "Silinəcək məhsul tapılmadı.");
    if (safeList(request.sales).some((sale) => safeList(sale.items).some((item) => item.productId === request.product.id))) {
      fail(409, "Satış tarixçəsində olan məhsulu silmək mümkün deyil.");
    }
    return { deleted: true };
  }

  function checkout({ customer, products, cart }) {
    if (!customer || customer.role !== "CUSTOMER") fail(403, "Sifariş üçün müştəri hesabına daxil ol.");
    if (!safeList(cart).length) fail(400, "Səbət boşdur.");
    const byId = new Map();
    for (const product of safeList(products)) {
      if (!product.id || byId.has(product.id)) fail(400, "Məhsul siyahısı etibarsızdır.");
      byId.set(product.id, product);
    }
    const seen = new Set();
    let total = 0;
    const items = safeList(cart).map((line) => {
      if (!line?.productId || !Number.isInteger(line.quantity) || line.quantity < 1 || seen.has(line.productId)) {
        fail(400, "Səbətdə etibarsız məhsul sayı var.");
      }
      seen.add(line.productId);
      const product = byId.get(line.productId);
      if (!product) fail(404, "Səbətdə olan məhsul tapılmadı.");
      if (line.quantity > product.stock) fail(409, `${product.name}: stokda yalnız ${product.stock} ədəd qalıb.`);
      if (!Number.isFinite(product.price) || product.price <= 0) fail(400, "Məhsul qiyməti etibarsızdır.");
      const lineTotal = money(product.price * line.quantity);
      total += lineTotal;
      return { productId: product.id, name: product.name, sku: product.sku, price: product.price, quantity: line.quantity, lineTotal };
    });
    const updatedProducts = safeList(products).map((product) => {
      const ordered = safeList(cart).find((line) => line.productId === product.id)?.quantity || 0;
      return ordered ? { ...product, stock: product.stock - ordered } : product;
    });
    const now = new Date();
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: STORE_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now).replaceAll("/", "-");
    const sale = {
      id: `ZS-${day.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`,
      createdAt: now.toISOString(),
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      items,
      total: money(total),
      status: "COMPLETED"
    };
    return { products: updatedProducts, sale };
  }

  function dateInStore(value) {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: STORE_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(value));
    const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${fields.year}-${fields.month}-${fields.day}`;
  }

  function parseDate(value) {
    if (!value) return null;
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      fail(400, "Tarix YYYY-MM-DD formatında olmalıdır.");
    }
    return value;
  }

  function report({ actor, sales, period, date }) {
    requireRole(actor, "ADMIN");
    if (!["day", "week", "month"].includes(period)) fail(400, "Hesabat dövrü day, week və ya month olmalıdır.");
    const selected = parseDate(date);
    if (!selected) fail(400, "Hesabat tarixi YYYY-MM-DD formatında olmalıdır.");
    const [year, month, day] = selected.split("-").map(Number);
    const selectedDate = new Date(Date.UTC(year, month - 1, day));
    const weekday = (selectedDate.getUTCDay() + 6) % 7;
    let start;
    let end;
    if (period === "week") {
      selectedDate.setUTCDate(selectedDate.getUTCDate() - weekday);
      start = selectedDate.toISOString().slice(0, 10);
      selectedDate.setUTCDate(selectedDate.getUTCDate() + 6);
      end = selectedDate.toISOString().slice(0, 10);
    } else if (period === "month") {
      start = `${year}-${String(month).padStart(2, "0")}-01`;
      end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    } else {
      start = selected;
      end = selected;
    }
    const filtered = safeList(sales).filter((sale) => {
      const dateValue = dateInStore(sale.createdAt);
      return dateValue >= start && dateValue <= end;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      sales: filtered,
      revenue: money(filtered.reduce((sum, sale) => sum + Number(sale.total), 0)),
      orderCount: filtered.length,
      unitCount: filtered.reduce((sum, sale) => sum + safeList(sale.items).reduce((n, item) => n + item.quantity, 0), 0),
      topProducts: topProducts(filtered),
      startDate: start,
      endDate: end
    };
  }

  function filterSales({ actor, sales, from, to }) {
    if (!actor || !["ADMIN", "STAFF"].includes(actor.role)) fail(403, "Satış hesabatına giriş icazən yoxdur.");
    const start = parseDate(from);
    const end = parseDate(to);
    if (start && end && start > end) fail(400, "Başlanğıc tarix son tarixdən sonra ola bilməz.");
    const filtered = safeList(sales).filter((sale) => {
      const date = dateInStore(sale.createdAt);
      return (!start || date >= start) && (!end || date <= end);
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const revenue = money(filtered.reduce((sum, sale) => sum + Number(sale.total), 0));
    return { sales: filtered, revenue, orderCount: filtered.length, averageOrder: filtered.length ? money(revenue / filtered.length) : 0 };
  }

  function csvExport({ actor, sales }) {
    if (!actor || !["ADMIN", "STAFF"].includes(actor.role)) fail(403, "Satış ixracına giriş icazən yoxdur.");
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [["Sifariş nömrəsi", "Tarix", "Müştəri", "E-poçt", "Məhsul detalları", "Ümumi say", "Yekun məbləğ AZN", "Status"]];
    for (const sale of safeList(sales)) {
      const details = safeList(sale.items).map((item) => `${item.name} (${item.sku}) x${item.quantity} = ${item.lineTotal}`).join(" | ");
      const quantity = safeList(sale.items).reduce((sum, item) => sum + item.quantity, 0);
      rows.push([sale.id, sale.createdAt, sale.customerName, sale.customerEmail, details, quantity, Number(sale.total).toFixed(2), sale.status === "COMPLETED" ? "Tamamlandı" : sale.status]);
    }
    return `\uFEFF${rows.map((row) => row.map(quote).join(",")).join("\r\n")}\r\n`;
  }

  async function request(path, method, body = {}) {
    const verb = String(method || "GET").toUpperCase();
    const route = path.split("?")[0].replace(/^\/api/, "");
    if (verb === "POST" && route === "/demo/seed") return clone(seed);
    if (verb === "POST" && route === "/access") return pageAccess(body);
    if (verb === "POST" && route === "/catalog/search") return catalog(body);
    if (verb === "POST" && route === "/cart/preview") return previewCart(body);
    if (verb === "POST" && route === "/cart/update") return updateCart(body);
    if (verb === "POST" && route === "/customers/orders") {
      if (!body.customer || body.customer.role !== "CUSTOMER") fail(403, "Sifariş tarixçəsi üçün müştəri hesabına daxil ol.");
      return safeList(body.sales).filter((sale) => sale.customerId === body.customer.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    if (verb === "POST" && route === "/admin/inventory") return inventory(body);
    if (verb === "POST" && route === "/admin/users") {
      requireRole(body.actor, "ADMIN");
      return safeList(body.users).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ id: userId, name, email, role, createdAt }) => ({ id: userId, name, email, password: null, role, createdAt }));
    }
    if (verb === "POST" && route === "/admin/dashboard") return dashboard(body);
    if (verb === "POST" && route === "/auth/login") return login(body);
    if (verb === "POST" && route === "/customers/register") return register(body);
    if (verb === "PUT" && /^\/customers\/[^/]+\/profile$/.test(route)) return updateProfile(decodeURIComponent(route.split("/")[2]), body);
    if (verb === "POST" && route === "/admin/staff") return createStaff(body);
    if (verb === "PUT" && /^\/admin\/customers\/[^/]+$/.test(route)) return updateCustomer(decodeURIComponent(route.split("/")[3]), body);
    if (verb === "POST" && route === "/products") {
      if (body.originalId) fail(400, "Yeni məhsul üçün originalId boş olmalıdır.");
      return saveProduct(body);
    }
    if (verb === "PUT" && /^\/products\/[^/]+$/.test(route)) {
      const productId = decodeURIComponent(route.split("/")[2]);
      if (productId !== body.originalId) fail(400, "Məhsul identifikatoru uyğun gəlmir.");
      return saveProduct(body);
    }
    if (verb === "DELETE" && /^\/products\/[^/]+$/.test(route)) {
      const productId = decodeURIComponent(route.split("/")[2]);
      if (!body.product || productId !== body.product.id) fail(400, "Məhsul identifikatoru uyğun gəlmir.");
      return deleteProduct(body);
    }
    if (verb === "POST" && route === "/sales/checkout") return checkout(body);
    if (verb === "POST" && route === "/reports") return report(body);
    if (verb === "POST" && route === "/sales/filter") return filterSales(body);
    if (verb === "POST" && route === "/sales/export") fail(400, "CSV ixracı üçün csv() metodundan istifadə et.");
    fail(404, `JavaScript biznes xidməti bu əməliyyatı tanımır: ${verb} ${path}`);
  }

  window.StoreService = Object.freeze({
    request,
    csv: csvExport
  });
})();
