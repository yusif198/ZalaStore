package com.vortex.zala.zalastore.api;

import com.vortex.zala.zalastore.api.StoreDtos.Product;
import com.vortex.zala.zalastore.api.StoreDtos.StoreSeedResponse;
import com.vortex.zala.zalastore.api.StoreDtos.UserAccount;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer {
	private final StoreSeedResponse seedData;

	public DataInitializer() {
		List<Product> products = List.of(
				new Product("p-001", "Kətan oversize köynək", "ZL-SH-001", "Köynək", new BigDecimal("48.00"), 12, "#c9bda8"),
				new Product("p-002", "Klassik bej trençkot", "ZL-OT-002", "Gödəkçə", new BigDecimal("129.00"), 4, "#b89878"),
				new Product("p-003", "Gündəlik denim cins", "ZL-TR-003", "Şalvar", new BigDecimal("76.00"), 18, "#68798b"),
				new Product("p-004", "Minimal midi don", "ZL-DR-004", "Don", new BigDecimal("94.00"), 3, "#a57e76"),
				new Product("p-005", "Yumşaq toxunma sviter", "ZL-KN-005", "Sviter", new BigDecimal("68.00"), 9, "#9ba492"),
				new Product("p-006", "Dəri çiyin çantası", "ZL-AC-006", "Aksesuar", new BigDecimal("85.00"), 7, "#9a6f54"),
				new Product("p-007", "Yüngül bomber gödəkçə", "ZL-OT-007", "Gödəkçə", new BigDecimal("112.00"), 2, "#707b6e"),
				new Product("p-008", "Rahat pambıq futbolka", "ZL-SH-008", "Köynək", new BigDecimal("35.00"), 22, "#d7d2c6"),
				new Product("p-009", "Düz kəsim şalvar", "ZL-TR-009", "Şalvar", new BigDecimal("72.00"), 11, "#77766c"),
				new Product("p-010", "Yumşaq yun şərf", "ZL-AC-010", "Aksesuar", new BigDecimal("29.00"), 5, "#bd806b"),
				new Product("p-011", "Atlas yay donu", "ZL-DR-011", "Don", new BigDecimal("118.00"), 6, "#9a9b9d"),
				new Product("p-012", "Klassik polo köynək", "ZL-SH-012", "Köynək", new BigDecimal("52.00"), 14, "#597471"));
		UserAccount admin = new UserAccount(
				"u-admin",
				"ZalaStore Admin",
				"admin@zalastore.az",
				"admin123",
				"ADMIN",
				OffsetDateTime.now().toString());
		seedData = new StoreSeedResponse(products, List.of(admin));
	}

	public StoreSeedResponse seedData() {
		return seedData;
	}
}
