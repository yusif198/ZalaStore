package com.vortex.zala.zalastore.api;

import com.vortex.zala.zalastore.api.StoreDtos.CartLine;
import com.vortex.zala.zalastore.api.StoreDtos.CheckoutRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CheckoutResponse;
import com.vortex.zala.zalastore.api.StoreDtos.AdminCustomerUpdateRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CatalogRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CatalogResponse;
import com.vortex.zala.zalastore.api.StoreDtos.CartPreviewLine;
import com.vortex.zala.zalastore.api.StoreDtos.CartPreviewRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CartPreviewResponse;
import com.vortex.zala.zalastore.api.StoreDtos.CartUpdateRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CartUpdateResponse;
import com.vortex.zala.zalastore.api.StoreDtos.CustomerOrdersRequest;
import com.vortex.zala.zalastore.api.StoreDtos.DashboardRequest;
import com.vortex.zala.zalastore.api.StoreDtos.DashboardResponse;
import com.vortex.zala.zalastore.api.StoreDtos.CsvExportRequest;
import com.vortex.zala.zalastore.api.StoreDtos.PageAccessRequest;
import com.vortex.zala.zalastore.api.StoreDtos.PageAccessResponse;
import com.vortex.zala.zalastore.api.StoreDtos.InventoryRequest;
import com.vortex.zala.zalastore.api.StoreDtos.InventoryResponse;
import com.vortex.zala.zalastore.api.StoreDtos.LoginRequest;
import com.vortex.zala.zalastore.api.StoreDtos.Product;
import com.vortex.zala.zalastore.api.StoreDtos.ProductDeleteRequest;
import com.vortex.zala.zalastore.api.StoreDtos.ProductSaveRequest;
import com.vortex.zala.zalastore.api.StoreDtos.ProfileUpdateRequest;
import com.vortex.zala.zalastore.api.StoreDtos.RegistrationRequest;
import com.vortex.zala.zalastore.api.StoreDtos.ReportRequest;
import com.vortex.zala.zalastore.api.StoreDtos.ReportResponse;
import com.vortex.zala.zalastore.api.StoreDtos.SaleFilterRequest;
import com.vortex.zala.zalastore.api.StoreDtos.SaleFilterResponse;
import com.vortex.zala.zalastore.api.StoreDtos.Sale;
import com.vortex.zala.zalastore.api.StoreDtos.SaleItem;
import com.vortex.zala.zalastore.api.StoreDtos.StaffCreateRequest;
import com.vortex.zala.zalastore.api.StoreDtos.StoreSeedResponse;
import com.vortex.zala.zalastore.api.StoreDtos.TopProduct;
import com.vortex.zala.zalastore.api.StoreDtos.UsersRequest;
import com.vortex.zala.zalastore.api.StoreDtos.UserAccount;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StoreBusinessService {
	private static final int LOW_STOCK_THRESHOLD = 5;
	private static final int PASSWORD_ITERATIONS = 120_000;
	private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
	private static final SecureRandom RANDOM = new SecureRandom();
	private static final ZoneId STORE_ZONE = ZoneId.of("Asia/Baku");
	private final DataInitializer dataInitializer;

	public StoreBusinessService(DataInitializer dataInitializer) {
		this.dataInitializer = dataInitializer;
	}

	public StoreSeedResponse demoSeed() {
		return dataInitializer.seedData();
	}

	public PageAccessResponse pageAccess(PageAccessRequest request) {
		String role = request.actor() == null ? "" : request.actor().role();
		List<String> allowedPages = switch (role) {
			case "CUSTOMER" -> List.of("store", "cart", "orders", "profile", "product", "auth");
			case "STAFF" -> List.of("store", "inventory", "sales", "product", "auth");
			case "ADMIN" -> List.of("store", "inventory", "dashboard", "sales", "reports", "users", "product", "auth");
			default -> List.of("store", "product", "auth");
		};
		return new PageAccessResponse(
				request.page() != null && allowedPages.contains(request.page()),
				allowedPages);
	}

	public CatalogResponse catalog(CatalogRequest request) {
		List<Product> products = safeList(request.products());
		String search = request.search() == null ? "" : request.search().trim().toLowerCase(Locale.ROOT);
		String category = request.category() == null ? "" : request.category().trim();
		List<Product> matching = products.stream()
				.filter(product -> category.isBlank() || product.category().equals(category))
				.filter(product -> search.isBlank() || (product.name() + " " + product.sku() + " " + product.category())
						.toLowerCase(Locale.ROOT).contains(search))
				.toList();
		List<String> categories = products.stream().map(Product::category).distinct()
				.sorted(String.CASE_INSENSITIVE_ORDER).toList();
		return new CatalogResponse(matching, categories, lowStock(products));
	}

	public CartPreviewResponse previewCart(CartPreviewRequest request) {
		Map<String, Product> products = new HashMap<>();
		for (Product product : safeList(request.products())) {
			if (product.id() == null || products.put(product.id(), product) != null) {
				throw badRequest("Məhsul siyahısı etibarsızdır.");
			}
		}
		List<CartPreviewLine> items = new ArrayList<>();
		Set<String> seen = new HashSet<>();
		BigDecimal subtotal = BigDecimal.ZERO;
		int quantity = 0;
		for (CartLine line : safeList(request.cart())) {
			if (line == null || line.productId() == null || line.quantity() < 1 || !seen.add(line.productId())) {
				throw badRequest("Səbətdə etibarsız məhsul sayı var.");
			}
			Product product = products.get(line.productId());
			if (product == null) {
				throw notFound("Səbətdə olan məhsul tapılmadı.");
			}
			if (line.quantity() > product.stock()) {
				throw conflict(product.name() + ": stokda yalnız " + product.stock() + " ədəd qalıb.");
			}
			BigDecimal lineTotal = product.price().multiply(BigDecimal.valueOf(line.quantity())).setScale(2);
			subtotal = subtotal.add(lineTotal);
			quantity += line.quantity();
			items.add(new CartPreviewLine(product, line.quantity(), lineTotal));
		}
		return new CartPreviewResponse(List.copyOf(items), subtotal.setScale(2), quantity);
	}

	public CartUpdateResponse updateCart(CartUpdateRequest request) {
		if (request.actor() == null || !"CUSTOMER".equals(request.actor().role())) {
			throw forbidden("Səbətdən istifadə üçün müştəri hesabına daxil ol.");
		}
		if (request.productId() == null || request.productId().isBlank()) {
			throw badRequest("Məhsul seçilməyib.");
		}
		List<CartLine> cart = new ArrayList<>(safeList(request.cart()));
		int index = -1;
		for (int i = 0; i < cart.size(); i++) {
			if (request.productId().equals(cart.get(i).productId())) {
				index = i;
				break;
			}
		}
		String action = request.action() == null ? "" : request.action().toUpperCase(Locale.ROOT);
		switch (action) {
			case "ADD" -> {
				int amount = request.quantity() == null ? 0 : request.quantity();
				if (amount < 1) {
					throw badRequest("Məhsul sayı ən azı 1 olmalıdır.");
				}
				if (index >= 0) {
					if (amount > Integer.MAX_VALUE - cart.get(index).quantity()) {
						throw badRequest("Məhsul sayı icazə verilən həddi aşır.");
					}
					cart.set(index, new CartLine(request.productId(), cart.get(index).quantity() + amount));
				} else {
					cart.add(new CartLine(request.productId(), amount));
				}
			}
			case "SET" -> {
				int amount = request.quantity() == null ? 0 : request.quantity();
				if (amount < 1) {
					throw badRequest("Məhsul sayı ən azı 1 olmalıdır.");
				}
				if (index < 0) {
					throw notFound("Səbətdə olan məhsul tapılmadı.");
				}
				cart.set(index, new CartLine(request.productId(), amount));
			}
			case "REMOVE" -> {
				if (index < 0) {
					throw notFound("Səbətdə olan məhsul tapılmadı.");
				}
				cart.remove(index);
			}
			default -> throw badRequest("Səbət əməliyyatı ADD, SET və ya REMOVE olmalıdır.");
		}
		List<CartLine> updatedCart = List.copyOf(cart);
		CartPreviewResponse preview = previewCart(new CartPreviewRequest(request.products(), updatedCart));
		return new CartUpdateResponse(updatedCart, preview);
	}

	public List<Sale> customerOrders(CustomerOrdersRequest request) {
		UserAccount customer = request.customer();
		if (customer == null || !"CUSTOMER".equals(customer.role())) {
			throw forbidden("Sifariş tarixçəsi üçün müştəri hesabına daxil ol.");
		}
		return safeList(request.sales()).stream()
				.filter(sale -> customer.id().equals(sale.customerId()))
				.sorted(Comparator.comparing(Sale::createdAt).reversed())
				.toList();
	}

	public InventoryResponse inventory(InventoryRequest request) {
		if (request.actor() == null || !Set.of("ADMIN", "STAFF").contains(request.actor().role())) {
			throw forbidden("Stok idarəetməsinə giriş icazən yoxdur.");
		}
		List<Product> products = safeList(request.products());
		return new InventoryResponse(products, lowStock(products));
	}

	public List<UserAccount> users(UsersRequest request) {
		requireRole(request.actor(), "ADMIN");
		return safeList(request.users()).stream()
				.sorted(Comparator.comparing(UserAccount::createdAt).reversed())
				.map(user -> new UserAccount(user.id(), user.name(), user.email(), null, user.role(), user.createdAt()))
				.toList();
	}

	public DashboardResponse dashboard(DashboardRequest request) {
		requireRole(request.actor(), "ADMIN");
		List<Product> products = safeList(request.products());
		List<UserAccount> users = safeList(request.users());
		List<Sale> sales = safeList(request.sales()).stream()
				.sorted(Comparator.comparing(Sale::createdAt).reversed())
				.toList();
		List<Product> lowStock = lowStock(products);
		BigDecimal revenue = sales.stream().map(Sale::total).filter(value -> value != null)
				.reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2);
		int customers = (int) users.stream().filter(user -> "CUSTOMER".equals(user.role())).count();
		int staff = (int) users.stream().filter(user -> "STAFF".equals(user.role())).count();
		return new DashboardResponse(
				products.size(),
				customers,
				staff,
				sales.size(),
				lowStock.size(),
				revenue,
				lowStock,
				sales.stream().limit(5).toList(),
				topProducts(sales));
	}

	public UserAccount login(LoginRequest request) {
		String email = normalizeEmail(request.email());
		if (request.password() == null || request.password().isBlank()) {
			throw badRequest("E-poçt və şifrə tələb olunur.");
		}
		UserAccount account = safeList(request.users()).stream()
				.filter(user -> normalizeEmail(user.email()).equals(email))
				.findFirst()
				.orElseThrow(() -> unauthorized("E-poçt və ya şifrə yanlışdır."));
		if (!passwordMatches(request.password(), account.password())) {
			throw unauthorized("E-poçt və ya şifrə yanlışdır.");
		}
		if (!isEncodedPassword(account.password())) {
			account = withPassword(account, encodePassword(request.password()));
		}
		return account;
	}

	public UserAccount register(RegistrationRequest request) {
		String name = requireFullName(request.name());
		String email = validateEmail(request.email());
		String password = validateNewPassword(request.password());
		ensureEmailAvailable(request.users(), email, null);
		return new UserAccount(
				"u-" + UUID.randomUUID(),
				name,
				email,
				encodePassword(password),
				"CUSTOMER",
				OffsetDateTime.now().toString());
	}

	public UserAccount updateCustomerProfile(String accountId, ProfileUpdateRequest request) {
		UserAccount account = request.account();
		if (account == null || !accountId.equals(account.id()) || !"CUSTOMER".equals(account.role())) {
			throw forbidden("Müştəri hesabı ilə davam et.");
		}
		if (request.currentPassword() == null || !passwordMatches(request.currentPassword(), account.password())) {
			throw unauthorized("Cari şifrə düzgün deyil.");
		}
		String name = requireFullName(request.name());
		String email = validateEmail(request.email());
		ensureEmailAvailable(request.users(), email, account.id());
		String password = account.password();
		if (request.newPassword() != null && !request.newPassword().isBlank()) {
			password = encodePassword(validateNewPassword(request.newPassword()));
		} else if (!isEncodedPassword(password)) {
			password = encodePassword(request.currentPassword());
		}
		return new UserAccount(account.id(), name, email, password, account.role(), account.createdAt());
	}

	public UserAccount createStaff(StaffCreateRequest request) {
		requireRole(request.actor(), "ADMIN");
		String name = requireFullName(request.name());
		String email = validateEmail(request.email());
		String password = validateNewPassword(request.password());
		ensureEmailAvailable(request.users(), email, null);
		return new UserAccount(
				"u-" + UUID.randomUUID(),
				name,
				email,
				encodePassword(password),
				"STAFF",
				OffsetDateTime.now().toString());
	}

	public UserAccount updateCustomerAsAdmin(String customerId, AdminCustomerUpdateRequest request) {
		requireRole(request.actor(), "ADMIN");
		UserAccount customer = request.customer();
		if (customer == null || !customerId.equals(customer.id()) || !"CUSTOMER".equals(customer.role())) {
			throw notFound("Müştəri hesabı tapılmadı.");
		}
		String name = requireFullName(request.name());
		String email = validateEmail(request.email());
		ensureEmailAvailable(request.users(), email, customer.id());
		String password = customer.password();
		if (request.newPassword() != null && !request.newPassword().isBlank()) {
			password = encodePassword(validateNewPassword(request.newPassword()));
		}
		return new UserAccount(customer.id(), name, email, password, customer.role(), customer.createdAt());
	}

	public Product saveProduct(ProductSaveRequest request) {
		requireRole(request.actor(), "ADMIN");
		Product product = request.product();
		if (product == null) {
			throw badRequest("Məhsul məlumatları tələb olunur.");
		}
		String name = requireText(product.name(), "Məhsul adı tələb olunur.");
		String sku = requireText(product.sku(), "SKU kodu tələb olunur.").toUpperCase(Locale.ROOT);
		String category = requireText(product.category(), "Kateqoriya tələb olunur.");
		if (product.price() == null || product.price().signum() <= 0 || product.price().scale() > 2) {
			throw badRequest("Qiymət müsbət olmalı və qəpik dəqiqliyini aşmamalıdır.");
		}
		if (product.stock() < 0) {
			throw badRequest("Stok sayı mənfi ola bilməz.");
		}
		String id = request.originalId() == null || request.originalId().isBlank()
				? "p-" + UUID.randomUUID()
				: request.originalId();
		boolean exists = safeList(request.products()).stream().anyMatch(item -> item.id().equals(id));
		if (request.originalId() != null && !request.originalId().isBlank() && !exists) {
			throw notFound("Redaktə ediləcək məhsul tapılmadı.");
		}
		boolean duplicateSku = safeList(request.products()).stream()
				.anyMatch(item -> !item.id().equals(id) && item.sku().equalsIgnoreCase(sku));
		if (duplicateSku) {
			throw conflict("Bu SKU kodu artıq istifadə olunur.");
		}
		return new Product(id, name, sku, category, product.price(), product.stock(), product.color());
	}

	public void deleteProduct(ProductDeleteRequest request) {
		requireRole(request.actor(), "ADMIN");
		if (request.product() == null) {
			throw badRequest("Silinəcək məhsul tapılmadı.");
		}
		boolean alreadySold = safeList(request.sales()).stream()
				.anyMatch(sale -> safeList(sale.items()).stream()
						.anyMatch(item -> item.productId().equals(request.product().id())));
		if (alreadySold) {
			throw conflict("Satış tarixçəsində olan məhsulu silmək mümkün deyil.");
		}
	}

	public CheckoutResponse checkout(CheckoutRequest request) {
		UserAccount customer = request.customer();
		if (customer == null || !"CUSTOMER".equals(customer.role())) {
			throw forbidden("Sifariş üçün müştəri hesabına daxil ol.");
		}
		List<Product> products = new ArrayList<>(safeList(request.products()));
		List<CartLine> cart = safeList(request.cart());
		if (cart.isEmpty()) {
			throw badRequest("Səbət boşdur.");
		}
		Map<String, Product> productById = new HashMap<>();
		for (Product product : products) {
			if (product.id() == null || productById.put(product.id(), product) != null) {
				throw badRequest("Məhsul siyahısı etibarsızdır.");
			}
		}
		Set<String> seen = new HashSet<>();
		List<SaleItem> items = new ArrayList<>();
		BigDecimal total = BigDecimal.ZERO;
		for (CartLine line : cart) {
			if (line == null || line.productId() == null || line.quantity() < 1 || !seen.add(line.productId())) {
				throw badRequest("Səbətdə etibarsız məhsul sayı var.");
			}
			Product product = productById.get(line.productId());
			if (product == null) {
				throw notFound("Səbətdə olan məhsul tapılmadı.");
			}
			if (line.quantity() > product.stock()) {
				throw conflict(product.name() + ": stokda yalnız " + product.stock() + " ədəd qalıb.");
			}
			if (product.price() == null || product.price().signum() <= 0) {
				throw badRequest("Məhsul qiyməti etibarsızdır.");
			}
			BigDecimal lineTotal = product.price().multiply(BigDecimal.valueOf(line.quantity())).setScale(2);
			total = total.add(lineTotal);
			items.add(new SaleItem(product.id(), product.name(), product.sku(), product.price(), line.quantity(), lineTotal));
		}
		List<Product> updatedProducts = products.stream()
				.map(product -> {
					int ordered = cart.stream()
							.filter(line -> line.productId().equals(product.id()))
							.mapToInt(CartLine::quantity)
							.sum();
					return ordered == 0 ? product : new Product(
							product.id(), product.name(), product.sku(), product.category(),
							product.price(), product.stock() - ordered, product.color());
				})
				.toList();
		String saleId = "ZS-" + LocalDate.now(STORE_ZONE).toString().replace("-", "") + "-"
				+ UUID.randomUUID().toString().substring(0, 5).toUpperCase(Locale.ROOT);
		Sale sale = new Sale(
				saleId,
				OffsetDateTime.now(STORE_ZONE).toString(),
				customer.id(),
				customer.name(),
				customer.email(),
				List.copyOf(items),
				total.setScale(2),
				"COMPLETED");
		return new CheckoutResponse(updatedProducts, sale);
	}

	public ReportResponse report(ReportRequest request) {
		requireRole(request.actor(), "ADMIN");
		if (request.period() == null || !Set.of("day", "week", "month").contains(request.period())) {
			throw badRequest("Hesabat dövrü day, week və ya month olmalıdır.");
		}
		LocalDate selectedDate;
		try {
			selectedDate = LocalDate.parse(request.date());
		} catch (RuntimeException exception) {
			throw badRequest("Hesabat tarixi YYYY-MM-DD formatında olmalıdır.");
		}
		LocalDate start = switch (request.period()) {
			case "week" -> selectedDate.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
			case "month" -> selectedDate.withDayOfMonth(1);
			default -> selectedDate;
		};
		LocalDate end = switch (request.period()) {
			case "week" -> start.plusDays(6);
			case "month" -> start.with(TemporalAdjusters.lastDayOfMonth());
			default -> start;
		};
		List<Sale> sales = safeList(request.sales()).stream()
				.filter(sale -> {
					try {
						LocalDate saleDate = OffsetDateTime.parse(sale.createdAt()).atZoneSameInstant(STORE_ZONE).toLocalDate();
						return !saleDate.isBefore(start) && !saleDate.isAfter(end);
					} catch (RuntimeException exception) {
						throw badRequest("Satış tarixçəsində tarix formatı etibarsızdır.");
					}
				})
				.sorted(Comparator.comparing(Sale::createdAt).reversed())
				.toList();
		BigDecimal revenue = sales.stream().map(Sale::total).filter(value -> value != null)
				.reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2);
		int units = sales.stream().flatMap(sale -> safeList(sale.items()).stream())
				.mapToInt(SaleItem::quantity).sum();
		List<TopProduct> topProducts = topProducts(sales);
		return new ReportResponse(sales, revenue, sales.size(), units, topProducts, start.toString(), end.toString());
	}

	public SaleFilterResponse filterSales(SaleFilterRequest request) {
		if (request.actor() == null || !Set.of("ADMIN", "STAFF").contains(request.actor().role())) {
			throw forbidden("Satış hesabatına giriş icazən yoxdur.");
		}
		LocalDate from = parseOptionalDate(request.from());
		LocalDate to = parseOptionalDate(request.to());
		if (from != null && to != null && from.isAfter(to)) {
			throw badRequest("Başlanğıc tarix son tarixdən sonra ola bilməz.");
		}
		List<Sale> filtered = safeList(request.sales()).stream()
				.filter(sale -> {
					try {
						LocalDate saleDate = OffsetDateTime.parse(sale.createdAt())
								.atZoneSameInstant(STORE_ZONE).toLocalDate();
						return (from == null || !saleDate.isBefore(from))
								&& (to == null || !saleDate.isAfter(to));
					} catch (RuntimeException exception) {
						throw badRequest("Satış tarixçəsində tarix formatı etibarsızdır.");
					}
				})
				.sorted(Comparator.comparing(Sale::createdAt).reversed())
				.toList();
		BigDecimal revenue = filtered.stream().map(Sale::total).filter(value -> value != null)
				.reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2);
		BigDecimal average = filtered.isEmpty()
				? BigDecimal.ZERO.setScale(2)
				: revenue.divide(BigDecimal.valueOf(filtered.size()), 2, java.math.RoundingMode.HALF_UP);
		return new SaleFilterResponse(filtered, revenue, filtered.size(), average);
	}

	public String exportSalesCsv(CsvExportRequest request) {
		if (request.actor() == null || !Set.of("ADMIN", "STAFF").contains(request.actor().role())) {
			throw forbidden("Satış ixracına giriş icazən yoxdur.");
		}
		StringBuilder csv = new StringBuilder("\uFEFF");
		appendCsvRow(csv, List.of(
				"Sifariş nömrəsi", "Tarix", "Müştəri", "E-poçt",
				"Məhsul detalları", "Ümumi say", "Yekun məbləğ AZN", "Status"));
		for (Sale sale : safeList(request.sales())) {
			String details = safeList(sale.items()).stream()
					.map(item -> item.name() + " (" + item.sku() + ") x" + item.quantity()
							+ " = " + item.lineTotal().toPlainString())
					.reduce((first, second) -> first + " | " + second)
					.orElse("");
			int quantity = safeList(sale.items()).stream().mapToInt(SaleItem::quantity).sum();
			appendCsvRow(csv, List.of(
					sale.id(),
					sale.createdAt(),
					sale.customerName(),
					sale.customerEmail(),
					details,
					Integer.toString(quantity),
					sale.total().toPlainString(),
					"COMPLETED".equals(sale.status()) ? "Tamamlandı" : sale.status()));
		}
		return csv.toString();
	}

	private static void appendCsvRow(StringBuilder csv, List<String> columns) {
		for (int i = 0; i < columns.size(); i++) {
			if (i > 0) {
				csv.append(',');
			}
			csv.append('"')
					.append(columns.get(i) == null ? "" : columns.get(i).replace("\"", "\"\""))
					.append('"');
		}
		csv.append("\r\n");
	}

	public boolean isLowStock(int stock) {
		return stock < LOW_STOCK_THRESHOLD;
	}

	private List<Product> lowStock(List<Product> products) {
		return safeList(products).stream().filter(product -> isLowStock(product.stock())).toList();
	}

	private List<TopProduct> topProducts(List<Sale> sales) {
		Map<String, TopProduct> ranking = new HashMap<>();
		for (Sale sale : safeList(sales)) {
			for (SaleItem item : safeList(sale.items())) {
				TopProduct old = ranking.get(item.productId());
				ranking.put(item.productId(), new TopProduct(
						item.productId(),
						item.name(),
						(old == null ? 0 : old.quantity()) + item.quantity(),
						(old == null ? BigDecimal.ZERO : old.revenue()).add(item.lineTotal())));
			}
		}
		return ranking.values().stream()
				.sorted(Comparator.comparingInt(TopProduct::quantity).reversed()
						.thenComparing(TopProduct::revenue, Comparator.reverseOrder()))
				.limit(5)
				.toList();
	}

	private static LocalDate parseOptionalDate(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		try {
			return LocalDate.parse(value);
		} catch (RuntimeException exception) {
			throw badRequest("Tarix YYYY-MM-DD formatında olmalıdır.");
		}
	}

	private static void ensureEmailAvailable(List<UserAccount> users, String email, String excludedId) {
		boolean duplicate = safeList(users).stream().anyMatch(user ->
				!user.id().equals(excludedId) && normalizeEmail(user.email()).equals(email));
		if (duplicate) {
			throw conflict("Bu e-poçtla artıq hesab mövcuddur.");
		}
	}

	private static void requireRole(UserAccount actor, String role) {
		if (actor == null || !role.equals(actor.role())) {
			throw forbidden("Bu əməliyyat üçün icazən yoxdur.");
		}
	}

	private static String validateEmail(String value) {
		String email = normalizeEmail(value);
		if (email.length() > 120 || !EMAIL_PATTERN.matcher(email).matches()) {
			throw badRequest("Düzgün e-poçt ünvanı daxil et.");
		}
		return email;
	}

	private static String validateNewPassword(String value) {
		if (value == null || value.length() < 6 || value.length() > 128) {
			throw badRequest("Şifrə 6–128 simvol arasında olmalıdır.");
		}
		return value;
	}

	private static String requireText(String value, String message) {
		String text = value == null ? "" : value.trim();
		if (text.isEmpty() || text.length() > 120) {
			throw badRequest(message);
		}
		return text;
	}

	private static String requireFullName(String value) {
		String name = requireText(value, "Ad və soyad tələb olunur.");
		if (name.split("\\s+").length < 2) {
			throw badRequest("Ad və soyad sahələrinə həm ad, həm də soyad yazılmalıdır.");
		}
		return name;
	}

	private static String normalizeEmail(String value) {
		return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
	}

	private static <T> List<T> safeList(List<T> values) {
		return values == null ? List.of() : values;
	}

	private static boolean isEncodedPassword(String password) {
		return password != null && password.startsWith("pbkdf2$");
	}

	private static String encodePassword(String password) {
		byte[] salt = new byte[16];
		RANDOM.nextBytes(salt);
		byte[] hash = derivePassword(password, salt, PASSWORD_ITERATIONS);
		return "pbkdf2$" + PASSWORD_ITERATIONS + "$" + Base64.getEncoder().encodeToString(salt) + "$"
				+ Base64.getEncoder().encodeToString(hash);
	}

	private static boolean passwordMatches(String rawPassword, String storedPassword) {
		if (rawPassword == null || storedPassword == null) {
			return false;
		}
		if (!isEncodedPassword(storedPassword)) {
			return MessageDigest.isEqual(
					rawPassword.getBytes(StandardCharsets.UTF_8),
					storedPassword.getBytes(StandardCharsets.UTF_8));
		}
		try {
			String[] parts = storedPassword.split("\\$", -1);
			if (parts.length != 4 || Integer.parseInt(parts[1]) < 10_000) {
				return false;
			}
			byte[] salt = Base64.getDecoder().decode(parts[2]);
			byte[] expected = Base64.getDecoder().decode(parts[3]);
			byte[] actual = derivePassword(rawPassword, salt, Integer.parseInt(parts[1]));
			return MessageDigest.isEqual(expected, actual);
		} catch (RuntimeException exception) {
			return false;
		}
	}

	private static byte[] derivePassword(String password, byte[] salt, int iterations) {
		try {
			javax.crypto.spec.PBEKeySpec spec = new javax.crypto.spec.PBEKeySpec(
					password.toCharArray(), salt, iterations, 256);
			try {
				return javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
						.generateSecret(spec).getEncoded();
			} finally {
				spec.clearPassword();
			}
		} catch (java.security.GeneralSecurityException exception) {
			throw new IllegalStateException("Şifrəni emal etmək mümkün olmadı.", exception);
		}
	}

	private static UserAccount withPassword(UserAccount account, String password) {
		return new UserAccount(
				account.id(), account.name(), account.email(), password, account.role(), account.createdAt());
	}

	private static ResponseStatusException badRequest(String message) {
		return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
	}

	private static ResponseStatusException unauthorized(String message) {
		return new ResponseStatusException(HttpStatus.UNAUTHORIZED, message);
	}

	private static ResponseStatusException forbidden(String message) {
		return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
	}

	private static ResponseStatusException notFound(String message) {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
	}

	private static ResponseStatusException conflict(String message) {
		return new ResponseStatusException(HttpStatus.CONFLICT, message);
	}
}
