package com.vortex.zala.zalastore.api;

import java.math.BigDecimal;
import java.util.List;

public final class StoreDtos {
	private StoreDtos() {
	}

	public record UserAccount(String id, String name, String email, String password, String role, String createdAt) {
	}

	public record Product(String id, String name, String sku, String category, BigDecimal price, int stock, String color) {
	}

	public record StoreSeedResponse(List<Product> products, List<UserAccount> users) {
	}

	public record CartLine(String productId, int quantity) {
	}

	public record CatalogRequest(List<Product> products, String search, String category) {
	}

	public record CatalogResponse(List<Product> products, List<String> categories, List<Product> lowStock) {
	}

	public record CartPreviewRequest(List<Product> products, List<CartLine> cart) {
	}

	public record CartPreviewLine(Product product, int quantity, BigDecimal lineTotal) {
	}

	public record CartPreviewResponse(List<CartPreviewLine> items, BigDecimal subtotal, int quantity) {
	}

	public record CartUpdateRequest(
			UserAccount actor,
			List<Product> products,
			List<CartLine> cart,
			String action,
			String productId,
			Integer quantity) {
	}

	public record CartUpdateResponse(List<CartLine> cart, CartPreviewResponse preview) {
	}

	public record CustomerOrdersRequest(UserAccount customer, List<Sale> sales) {
	}

	public record InventoryRequest(UserAccount actor, List<Product> products) {
	}

	public record InventoryResponse(List<Product> products, List<Product> lowStock) {
	}

	public record UsersRequest(UserAccount actor, List<UserAccount> users) {
	}

	public record DashboardRequest(
			UserAccount actor,
			List<Product> products,
			List<UserAccount> users,
			List<Sale> sales) {
	}

	public record DashboardResponse(
			int productCount,
			int customerCount,
			int staffCount,
			int saleCount,
			int lowStockCount,
			BigDecimal revenue,
			List<Product> lowStock,
			List<Sale> recentSales,
			List<TopProduct> topProducts) {
	}

	public record PageAccessRequest(UserAccount actor, String page) {
	}

	public record PageAccessResponse(boolean allowed, List<String> allowedPages) {
	}

	public record CsvExportRequest(UserAccount actor, List<Sale> sales) {
	}

	public record SaleItem(String productId, String name, String sku, BigDecimal price, int quantity, BigDecimal lineTotal) {
	}

	public record Sale(
			String id,
			String createdAt,
			String customerId,
			String customerName,
			String customerEmail,
			List<SaleItem> items,
			BigDecimal total,
			String status) {
	}

	public record LoginRequest(String email, String password, List<UserAccount> users) {
	}

	public record RegistrationRequest(String name, String email, String password, List<UserAccount> users) {
	}

	public record ProfileUpdateRequest(
			UserAccount account,
			List<UserAccount> users,
			String name,
			String email,
			String currentPassword,
			String newPassword) {
	}

	public record StaffCreateRequest(
			UserAccount actor,
			List<UserAccount> users,
			String name,
			String email,
			String password) {
	}

	public record AdminCustomerUpdateRequest(
			UserAccount actor,
			List<UserAccount> users,
			UserAccount customer,
			String name,
			String email,
			String newPassword) {
	}

	public record ProductSaveRequest(
			UserAccount actor,
			List<Product> products,
			Product product,
			String originalId) {
	}

	public record ProductDeleteRequest(UserAccount actor, Product product, List<Sale> sales) {
	}

	public record CheckoutRequest(UserAccount customer, List<Product> products, List<CartLine> cart) {
	}

	public record CheckoutResponse(List<Product> products, Sale sale) {
	}

	public record TopProduct(String productId, String name, int quantity, BigDecimal revenue) {
	}

	public record ReportRequest(UserAccount actor, List<Sale> sales, String period, String date) {
	}

	public record SaleFilterRequest(UserAccount actor, List<Sale> sales, String from, String to) {
	}

	public record SaleFilterResponse(List<Sale> sales, BigDecimal revenue, int orderCount, BigDecimal averageOrder) {
	}

	public record ReportResponse(
			List<Sale> sales,
			BigDecimal revenue,
			int orderCount,
			int unitCount,
			List<TopProduct> topProducts,
			String startDate,
			String endDate) {
	}
}
