package com.vortex.zala.zalastore.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vortex.zala.zalastore.api.StoreDtos.CartLine;
import com.vortex.zala.zalastore.api.StoreDtos.CartPreviewRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CartUpdateRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CheckoutRequest;
import com.vortex.zala.zalastore.api.StoreDtos.AdminCustomerUpdateRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CatalogRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CsvExportRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CustomerOrdersRequest;
import com.vortex.zala.zalastore.api.StoreDtos.DashboardRequest;
import com.vortex.zala.zalastore.api.StoreDtos.InventoryRequest;
import com.vortex.zala.zalastore.api.StoreDtos.PageAccessRequest;
import com.vortex.zala.zalastore.api.StoreDtos.Product;
import com.vortex.zala.zalastore.api.StoreDtos.ProfileUpdateRequest;
import com.vortex.zala.zalastore.api.StoreDtos.RegistrationRequest;
import com.vortex.zala.zalastore.api.StoreDtos.ReportRequest;
import com.vortex.zala.zalastore.api.StoreDtos.Sale;
import com.vortex.zala.zalastore.api.StoreDtos.SaleFilterRequest;
import com.vortex.zala.zalastore.api.StoreDtos.SaleItem;
import com.vortex.zala.zalastore.api.StoreDtos.UserAccount;
import com.vortex.zala.zalastore.api.StoreDtos.UsersRequest;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class StoreBusinessServiceTests {
	private final StoreBusinessService service = new StoreBusinessService(new DataInitializer());

	@Test
	void registersHashesPasswordsAndAuthenticatesAgainstStoredHash() {
		UserAccount registered = service.register(new RegistrationRequest("Aysel Məmmədova", " Aysel@Example.az ", "secret123", List.of()));

		assertThat(registered.email()).isEqualTo("aysel@example.az");
		assertThat(registered.password()).startsWith("pbkdf2$");
		assertThat(registered.password()).doesNotContain("secret123");
		assertThat(service.login(new StoreDtos.LoginRequest("AYSEL@example.az", "secret123", List.of(registered))))
				.isEqualTo(registered);
		assertThatThrownBy(() -> service.login(new StoreDtos.LoginRequest("aysel@example.az", "wrongpass", List.of(registered))))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("401 UNAUTHORIZED");
	}

	@Test
	void updatesCustomerProfileAndRequiresCurrentPassword() {
		UserAccount account = service.register(new RegistrationRequest("Aysel Məmmədova", "aysel@example.az", "secret123", List.of()));
		UserAccount updated = service.updateCustomerProfile(account.id(), new ProfileUpdateRequest(
				account, List.of(account), "Aysel Məmmədova", "aysel.new@example.az", "secret123", "newsecret123"));

		assertThat(updated.name()).isEqualTo("Aysel Məmmədova");
		assertThat(updated.email()).isEqualTo("aysel.new@example.az");
		assertThat(service.login(new StoreDtos.LoginRequest(updated.email(), "newsecret123", List.of(updated))))
				.isEqualTo(updated);
		assertThatThrownBy(() -> service.updateCustomerProfile(account.id(), new ProfileUpdateRequest(
				account, List.of(account), "Aysel", "aysel@example.az", "wrongpass", "")))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("401 UNAUTHORIZED");
		assertThatThrownBy(() -> service.updateCustomerProfile(account.id(), new ProfileUpdateRequest(
				account, List.of(account), "Aysel", "aysel@example.az", "secret123", "")))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("400 BAD_REQUEST");
	}

	@Test
	void registrationRequiresFirstAndLastName() {
		assertThatThrownBy(() -> service.register(new RegistrationRequest("Aysel", "aysel@example.az", "secret123", List.of())))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("400 BAD_REQUEST");
	}

	@Test
	void checkoutCalculatesTotalAndDeductsStockOnServer() {
		UserAccount customer = service.register(new RegistrationRequest("Aysel Məmmədova", "aysel@example.az", "secret123", List.of()));
		Product product = new Product("p-1", "Köynək", "SKU-1", "Köynək", new BigDecimal("19.95"), 7, "#aabbcc");

		var response = service.checkout(new CheckoutRequest(customer, List.of(product), List.of(new CartLine("p-1", 3))));

		assertThat(response.products()).singleElement().extracting(Product::stock).isEqualTo(4);
		assertThat(response.sale().total()).isEqualByComparingTo("59.85");
		assertThat(response.sale().items()).singleElement().extracting(item -> item.lineTotal()).isEqualTo(new BigDecimal("59.85"));
	}

	@Test
	void checkoutRejectsInsufficientStockWithoutReturningAnUpdatedInventory() {
		UserAccount customer = service.register(new RegistrationRequest("Aysel Məmmədova", "aysel@example.az", "secret123", List.of()));
		Product product = new Product("p-1", "Köynək", "SKU-1", "Köynək", new BigDecimal("19.95"), 2, "#aabbcc");

		assertThatThrownBy(() -> service.checkout(new CheckoutRequest(customer, List.of(product), List.of(new CartLine("p-1", 3)))))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("409 CONFLICT");
		assertThat(product.stock()).isEqualTo(2);
	}

	@Test
	void reportsAndDateFiltersEnforceRolesAndCalculateTotals() {
		UserAccount admin = new UserAccount("admin", "Admin", "admin@example.az", "hash", "ADMIN", "2026-10-23T00:00:00Z");
		UserAccount customer = new UserAccount("customer", "Aysel", "aysel@example.az", "hash", "CUSTOMER", "2026-10-23T00:00:00Z");
		Sale sale = new Sale(
				"ZS-1",
				"2026-10-23T10:00:00+04:00",
				customer.id(),
				customer.name(),
				customer.email(),
				List.of(new SaleItem("p-1", "Köynək", "SKU-1", new BigDecimal("15.00"), 2, new BigDecimal("30.00"))),
				new BigDecimal("30.00"),
				"COMPLETED");

		var report = service.report(new ReportRequest(admin, List.of(sale), "month", "2026-10-23"));
		assertThat(report.orderCount()).isEqualTo(1);
		assertThat(report.unitCount()).isEqualTo(2);
		assertThat(report.revenue()).isEqualByComparingTo("30.00");
		assertThat(report.topProducts()).singleElement().extracting(item -> item.quantity()).isEqualTo(2);
		assertThat(service.filterSales(new SaleFilterRequest(
				new UserAccount("staff", "Staff", "staff@example.az", "hash", "STAFF", "2026-10-23T00:00:00Z"),
				List.of(sale), "2026-10-23", "2026-10-23")).orderCount()).isEqualTo(1);
		assertThatThrownBy(() -> service.report(new ReportRequest(customer, List.of(sale), "day", "2026-10-23")))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("403 FORBIDDEN");
	}

	@Test
	void adminCanUpdateCustomerDetailsAndResetTheirPassword() {
		UserAccount admin = new UserAccount("admin", "Admin", "admin@example.az", "hash", "ADMIN", "2026-10-23T00:00:00Z");
		UserAccount customer = service.register(new RegistrationRequest("Aysel Məmmədova", "aysel@example.az", "secret123", List.of()));
		UserAccount updated = service.updateCustomerAsAdmin(customer.id(), new AdminCustomerUpdateRequest(
				admin,
				List.of(admin, customer),
				customer,
				"Aysel Məmmədova",
				"aysel.new@example.az",
				"reset456"));

		assertThat(updated.name()).isEqualTo("Aysel Məmmədova");
		assertThat(updated.email()).isEqualTo("aysel.new@example.az");
		assertThat(service.login(new StoreDtos.LoginRequest(updated.email(), "reset456", List.of(updated))))
				.isEqualTo(updated);
		assertThatThrownBy(() -> service.updateCustomerAsAdmin(customer.id(), new AdminCustomerUpdateRequest(
				customer,
				List.of(admin, customer),
				customer,
				"Aysel",
				"aysel@example.az",
				"")))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("403 FORBIDDEN");
	}

	@Test
	void catalogAndCartPreviewApplyServerSideFilteringAndTotals() {
		Product inStock = new Product("p-1", "Kətan köynək", "SKU-1", "Köynək", new BigDecimal("19.95"), 7, "#aabbcc");
		Product lowStock = new Product("p-2", "Bej trençkot", "SKU-2", "Gödəkçə", new BigDecimal("99.00"), 2, "#aabbcc");

		var catalog = service.catalog(new CatalogRequest(List.of(inStock, lowStock), "KƏTAN", ""));
		var cart = service.previewCart(new CartPreviewRequest(List.of(inStock, lowStock), List.of(new CartLine("p-1", 3))));

		assertThat(catalog.products()).containsExactly(inStock);
		assertThat(catalog.categories()).containsExactly("Gödəkçə", "Köynək");
		assertThat(catalog.lowStock()).containsExactly(lowStock);
		assertThat(cart.quantity()).isEqualTo(3);
		assertThat(cart.subtotal()).isEqualByComparingTo("59.85");
		assertThat(cart.items()).singleElement().extracting(item -> item.lineTotal()).isEqualTo(new BigDecimal("59.85"));
		assertThatThrownBy(() -> service.previewCart(new CartPreviewRequest(
				List.of(lowStock), List.of(new CartLine("p-2", 3)))))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("409 CONFLICT");
	}

	@Test
	void demoSeedAndCartMutationsAreProvidedByJava() {
		var seed = service.demoSeed();
		UserAccount customer = new UserAccount("customer", "Aysel", "aysel@example.az", "hash", "CUSTOMER", "2026-10-23T00:00:00Z");
		Product product = seed.products().get(0);
		var added = service.updateCart(new CartUpdateRequest(customer, seed.products(), List.of(), "ADD", product.id(), 2));
		var changed = service.updateCart(new CartUpdateRequest(customer, seed.products(), added.cart(), "SET", product.id(), 3));
		var removed = service.updateCart(new CartUpdateRequest(customer, seed.products(), changed.cart(), "REMOVE", product.id(), null));

		assertThat(seed.products()).hasSize(12);
		assertThat(seed.users()).singleElement().extracting(UserAccount::role).isEqualTo("ADMIN");
		assertThat(added.preview().subtotal()).isEqualByComparingTo(product.price().multiply(new BigDecimal("2")));
		assertThat(changed.cart()).singleElement().extracting(CartLine::quantity).isEqualTo(3);
		assertThat(removed.cart()).isEmpty();
		assertThatThrownBy(() -> service.updateCart(new CartUpdateRequest(
				customer, seed.products(), List.of(), "ADD", seed.products().get(1).id(), 5)))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("409 CONFLICT");
	}

	@Test
	void pageAccessAndCsvExportAreHandledByJava() {
		UserAccount customer = new UserAccount("customer", "Aysel", "aysel@example.az", "hash", "CUSTOMER", "2026-10-23T00:00:00Z");
		UserAccount staff = new UserAccount("staff", "Staff", "staff@example.az", "hash", "STAFF", "2026-10-23T00:00:00Z");
		assertThat(service.pageAccess(new PageAccessRequest(customer, "cart")).allowed()).isTrue();
		assertThat(service.pageAccess(new PageAccessRequest(customer, "product")).allowed()).isTrue();
		assertThat(service.pageAccess(new PageAccessRequest(null, "product")).allowed()).isTrue();
		assertThat(service.pageAccess(new PageAccessRequest(customer, "reports")).allowed()).isFalse();

		Sale sale = new Sale("ZS-1", "2026-10-23T10:00:00+04:00", customer.id(), "Aysel, Məmmədova", customer.email(),
				List.of(new SaleItem("p-1", "Köynək \"klassik\"", "SKU-1", new BigDecimal("15.00"), 2, new BigDecimal("30.00"))),
				new BigDecimal("30.00"), "COMPLETED");
		String csv = service.exportSalesCsv(new CsvExportRequest(staff, List.of(sale)));

		assertThat(csv).startsWith("\uFEFF");
		assertThat(csv).contains("\"Aysel, Məmmədova\"").contains("Köynək \"\"klassik\"\" (SKU-1) x2 = 30.00").contains("\"Tamamlandı\"");
		assertThatThrownBy(() -> service.exportSalesCsv(new CsvExportRequest(customer, List.of(sale))))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("403 FORBIDDEN");
	}

	@Test
	void dashboardInventoryUsersAndOrdersAreFilteredByJavaServices() {
		UserAccount admin = new UserAccount("admin", "Admin", "admin@example.az", "hash", "ADMIN", "2026-10-23T00:00:00Z");
		UserAccount customer = new UserAccount("customer", "Aysel", "aysel@example.az", "hash", "CUSTOMER", "2026-10-23T00:00:00Z");
		UserAccount staff = new UserAccount("staff", "Staff", "staff@example.az", "hash", "STAFF", "2026-10-23T00:00:00Z");
		Product lowStock = new Product("p-1", "Köynək", "SKU-1", "Köynək", new BigDecimal("15.00"), 3, "#aabbcc");
		Sale sale = new Sale("ZS-1", "2026-10-23T10:00:00+04:00", customer.id(), customer.name(), customer.email(),
				List.of(new SaleItem("p-1", "Köynək", "SKU-1", new BigDecimal("15.00"), 2, new BigDecimal("30.00"))),
				new BigDecimal("30.00"), "COMPLETED");

		var dashboard = service.dashboard(new DashboardRequest(admin, List.of(lowStock), List.of(admin, customer, staff), List.of(sale)));
		var inventory = service.inventory(new InventoryRequest(staff, List.of(lowStock)));
		var users = service.users(new UsersRequest(admin, List.of(admin, customer, staff)));
		var orders = service.customerOrders(new CustomerOrdersRequest(customer, List.of(sale)));

		assertThat(dashboard.productCount()).isEqualTo(1);
		assertThat(dashboard.customerCount()).isEqualTo(1);
		assertThat(dashboard.staffCount()).isEqualTo(1);
		assertThat(dashboard.revenue()).isEqualByComparingTo("30.00");
		assertThat(dashboard.lowStock()).containsExactly(lowStock);
		assertThat(inventory.lowStock()).containsExactly(lowStock);
		assertThat(users).hasSize(3).allSatisfy(account -> assertThat(account.password()).isNull());
		assertThat(orders).containsExactly(sale);
		assertThatThrownBy(() -> service.inventory(new InventoryRequest(customer, List.of(lowStock))))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("403 FORBIDDEN");
	}
}
