package com.vortex.zala.zalastore.api;

import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.util.UriUtils;

@Controller
public class PageController {

	@GetMapping("/login")
	public String login() {
		return "redirect:/login.html";
	}

	@GetMapping("/register")
	public String register() {
		return "redirect:/register.html";
	}

	@GetMapping("/store")
	public String store() {
		return "redirect:/index.html";
	}

	@GetMapping("/products/{productId}")
	public String product(@PathVariable String productId) {
		return "redirect:/product.html?id=" + UriUtils.encodeQueryParam(productId, StandardCharsets.UTF_8);
	}

	@GetMapping("/cart")
	public String cart() {
		return "redirect:/cart.html";
	}

	@GetMapping("/orders")
	public String orders() {
		return "redirect:/orders.html";
	}

	@GetMapping("/profile")
	public String profile() {
		return "redirect:/profile.html";
	}

	@GetMapping("/inventory")
	public String inventory() {
		return "redirect:/inventory.html";
	}

	@GetMapping("/dashboard")
	public String dashboard() {
		return "redirect:/dashboard.html";
	}

	@GetMapping("/sales")
	public String sales() {
		return "redirect:/sales.html";
	}

	@GetMapping("/reports")
	public String reports() {
		return "redirect:/reports.html";
	}

	@GetMapping("/users")
	public String users() {
		return "redirect:/users.html";
	}
}
