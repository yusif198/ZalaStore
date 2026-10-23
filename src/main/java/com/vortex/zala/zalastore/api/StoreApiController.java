package com.vortex.zala.zalastore.api;

import com.vortex.zala.zalastore.api.StoreDtos.CheckoutRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CheckoutResponse;
import com.vortex.zala.zalastore.api.StoreDtos.AdminCustomerUpdateRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CatalogRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CatalogResponse;
import com.vortex.zala.zalastore.api.StoreDtos.CartPreviewRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CartPreviewResponse;
import com.vortex.zala.zalastore.api.StoreDtos.CartUpdateRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CartUpdateResponse;
import com.vortex.zala.zalastore.api.StoreDtos.CsvExportRequest;
import com.vortex.zala.zalastore.api.StoreDtos.CustomerOrdersRequest;
import com.vortex.zala.zalastore.api.StoreDtos.DashboardRequest;
import com.vortex.zala.zalastore.api.StoreDtos.DashboardResponse;
import com.vortex.zala.zalastore.api.StoreDtos.InventoryRequest;
import com.vortex.zala.zalastore.api.StoreDtos.InventoryResponse;
import com.vortex.zala.zalastore.api.StoreDtos.LoginRequest;
import com.vortex.zala.zalastore.api.StoreDtos.PageAccessRequest;
import com.vortex.zala.zalastore.api.StoreDtos.PageAccessResponse;
import com.vortex.zala.zalastore.api.StoreDtos.Product;
import com.vortex.zala.zalastore.api.StoreDtos.ProductDeleteRequest;
import com.vortex.zala.zalastore.api.StoreDtos.ProductSaveRequest;
import com.vortex.zala.zalastore.api.StoreDtos.ProfileUpdateRequest;
import com.vortex.zala.zalastore.api.StoreDtos.RegistrationRequest;
import com.vortex.zala.zalastore.api.StoreDtos.ReportRequest;
import com.vortex.zala.zalastore.api.StoreDtos.ReportResponse;
import com.vortex.zala.zalastore.api.StoreDtos.SaleFilterRequest;
import com.vortex.zala.zalastore.api.StoreDtos.SaleFilterResponse;
import com.vortex.zala.zalastore.api.StoreDtos.StaffCreateRequest;
import com.vortex.zala.zalastore.api.StoreDtos.StoreSeedResponse;
import com.vortex.zala.zalastore.api.StoreDtos.UserAccount;
import com.vortex.zala.zalastore.api.StoreDtos.UsersRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class StoreApiController {
	private final StoreBusinessService businessService;

	public StoreApiController(StoreBusinessService businessService) {
		this.businessService = businessService;
	}

	@PostMapping("/catalog/search")
	public CatalogResponse catalog(@RequestBody CatalogRequest request) {
		return businessService.catalog(request);
	}

	@PostMapping("/demo/seed")
	public StoreSeedResponse demoSeed() {
		return businessService.demoSeed();
	}

	@PostMapping("/access")
	public PageAccessResponse pageAccess(@RequestBody PageAccessRequest request) {
		return businessService.pageAccess(request);
	}

	@PostMapping("/cart/preview")
	public CartPreviewResponse previewCart(@RequestBody CartPreviewRequest request) {
		return businessService.previewCart(request);
	}

	@PostMapping("/cart/update")
	public CartUpdateResponse updateCart(@RequestBody CartUpdateRequest request) {
		return businessService.updateCart(request);
	}

	@PostMapping("/customers/orders")
	public List<StoreDtos.Sale> customerOrders(@RequestBody CustomerOrdersRequest request) {
		return businessService.customerOrders(request);
	}

	@PostMapping("/admin/inventory")
	public InventoryResponse inventory(@RequestBody InventoryRequest request) {
		return businessService.inventory(request);
	}

	@PostMapping("/admin/users")
	public List<UserAccount> users(@RequestBody UsersRequest request) {
		return businessService.users(request);
	}

	@PostMapping("/admin/dashboard")
	public DashboardResponse dashboard(@RequestBody DashboardRequest request) {
		return businessService.dashboard(request);
	}

	@PostMapping("/auth/login")
	public UserAccount login(@RequestBody LoginRequest request) {
		return businessService.login(request);
	}

	@PostMapping("/customers/register")
	public UserAccount register(@RequestBody RegistrationRequest request) {
		return businessService.register(request);
	}

	@PutMapping("/customers/{accountId}/profile")
	public UserAccount updateProfile(
			@PathVariable String accountId,
			@RequestBody ProfileUpdateRequest request) {
		return businessService.updateCustomerProfile(accountId, request);
	}

	@PostMapping("/admin/staff")
	public UserAccount createStaff(@RequestBody StaffCreateRequest request) {
		return businessService.createStaff(request);
	}

	@PutMapping("/admin/customers/{customerId}")
	public UserAccount updateCustomer(
			@PathVariable String customerId,
			@RequestBody AdminCustomerUpdateRequest request) {
		return businessService.updateCustomerAsAdmin(customerId, request);
	}

	@PostMapping("/products")
	public Product createProduct(@RequestBody ProductSaveRequest request) {
		if (request.originalId() != null && !request.originalId().isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Yeni məhsul üçün originalId boş olmalıdır.");
		}
		return businessService.saveProduct(request);
	}

	@PutMapping("/products/{productId}")
	public Product updateProduct(
			@PathVariable String productId,
			@RequestBody ProductSaveRequest request) {
		if (!productId.equals(request.originalId())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Məhsul identifikatoru uyğun gəlmir.");
		}
		return businessService.saveProduct(request);
	}

	@DeleteMapping("/products/{productId}")
	public Map<String, Boolean> deleteProduct(
			@PathVariable String productId,
			@RequestBody ProductDeleteRequest request) {
		if (request.product() == null || !productId.equals(request.product().id())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Məhsul identifikatoru uyğun gəlmir.");
		}
		businessService.deleteProduct(request);
		return Map.of("deleted", true);
	}

	@PostMapping("/sales/checkout")
	public CheckoutResponse checkout(@RequestBody CheckoutRequest request) {
		return businessService.checkout(request);
	}

	@PostMapping("/reports")
	public ReportResponse report(@RequestBody ReportRequest request) {
		return businessService.report(request);
	}

	@PostMapping("/sales/filter")
	public SaleFilterResponse filterSales(@RequestBody SaleFilterRequest request) {
		return businessService.filterSales(request);
	}

	@PostMapping(value = "/sales/export", produces = "text/csv")
	public ResponseEntity<String> exportSalesCsv(@RequestBody CsvExportRequest request) {
		return ResponseEntity.ok()
				.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"zalastore-satislar.csv\"")
				.contentType(new MediaType("text", "csv"))
				.body(businessService.exportSalesCsv(request));
	}
}
