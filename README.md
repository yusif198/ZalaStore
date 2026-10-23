# ZalaStore

ZalaStore is a Java 21 / Spring Boot clothing-store demo. Spring Boot serves the storefront and provides REST endpoints for account operations, profile updates, product management, checkout, sales filtering, and reporting. The browser keeps products, accounts, cart contents, stock, and completed sales in `localStorage`, as requested.

## Run locally

Requirements: Java 21.

```powershell
.\mvnw.cmd spring-boot:run
```

Open [http://localhost:8080](http://localhost:8080). Each section is a separate HTML page served by Spring Boot:

- `index.html` — storefront
- `cart.html`, `orders.html`, `profile.html` — customer pages
- `inventory.html`, `dashboard.html`, `sales.html`, `reports.html`, `users.html` — management pages
- `login.html`, `register.html` — separate login and registration pages

Friendly page paths such as `/login`, `/register`, `/cart`, and `/dashboard` redirect to their corresponding HTML files.

Navigation loads the corresponding page directly; localStorage keeps the demo data available across page loads. To use another port, set `PORT` before starting the application.

## Demo accounts

- Admin: `admin@zalastore.az` / `admin123`
- Customers can register and update their own name, email, and password from **Hesabım**.
- Admins can create staff accounts from **İstifadəçilər**.
- Admins can edit customer name/email and set a new customer password from **İstifadəçilər**.

Passwords for newly registered accounts (and the seeded admin after first sign-in) are hashed by Spring Boot with PBKDF2 before being saved in localStorage. Clearing the site's local storage resets the browser's data to the sample catalog and initial admin account. Do not use real customer information or passwords.

## Java backend

`DataInitializer` supplies the sample product catalog and initial admin account to the demo seed endpoint. Spring Boot runs the business rules behind endpoints under `/api`:

- `/api/auth/login`, `/api/customers/register`, `/api/customers/{id}/profile`
- `/api/admin/staff`, `/api/admin/customers/{id}`, `/api/products`
- `/api/demo/seed`, `/api/access`, `/api/catalog/search`, `/api/cart/preview`, `/api/cart/update`, `/api/customers/orders`
- `/api/admin/inventory`, `/api/admin/users`, `/api/admin/dashboard`
- `/api/sales/checkout`, `/api/sales/filter`, `/api/sales/export`, `/api/reports`

The server provides the demo seed, role-based page access decisions, catalog filtering, low-stock alerts, cart mutations and totals, customer order history, inventory/user lists, dashboard KPIs and top-five products. It also validates account/profile changes, hashes passwords, validates product changes, checks stock and deducts it at checkout, calculates date-filtered sales/report aggregates, and generates escaped CSV content. The browser persists returned updates in localStorage.

`app.js` is limited to browser-specific behavior such as rendering HTML, handling events, navigation, localStorage persistence, theme preference, and triggering a downloaded CSV file. A saved light/dark theme applies across all pages.

## Included features

- Clothing catalog with sample product illustrations, search, category filter, products grouped under category headings, and a left-side product preview. The cart shortcut is hidden on the storefront and remains available on other customer pages.
- Customer registration/login, profile editing, cart quantities, order total, and demo checkout (no payment gateway).
- Java-side stock validation/deduction at checkout, low-stock warnings below five units, and server-validated product create/edit/delete.
- Admin, staff, and customer views; staff has read-only inventory access.
- Java-side date-filtered sale history/details, daily/weekly/monthly sales totals, top-five chart data, and CSV export.

## Important limitations

This is a single-browser prototype, not a production e-commerce system. `localStorage` is client-controlled and is the only data store; records do not sync across browsers or devices and can be edited or cleared by the user. API requests supply the browser's current local records and role, so the server cannot establish a trusted identity or securely authorize users. PBKDF2 protects stored passwords from being immediately readable, but it does not make browser-stored accounts secure. Inventory checks therefore protect normal app flows, not concurrent users or tampering. Use a server-side database, authenticated sessions, and server-enforced authorization before handling real customers, payments, or shared inventory.
