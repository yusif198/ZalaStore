# ZalaStore

ZalaStore is a static JavaScript clothing-store demo configured for Vercel. The browser runs the store business rules and saves products, accounts, carts, stock, and sales in `localStorage`; the application makes no Spring Boot or network API calls.

## Deploy to Vercel

Import this project in Vercel and deploy from the repository root (`.`). The Vercel Framework Preset should be **Other**; `vercel.json` also pins it to Other so Vercel does not interpret browser scripts as server functions. Vercel runs `npm run build`, which copies the storefront into `dist/`; only that directory is deployed as static output. Spring sources and the preserved Spring Boot backup are excluded from the Vercel deployment by `.vercelignore`.

The app uses browser Web Crypto for PBKDF2 password hashes. Vercel's HTTPS deployment provides the secure context required by Web Crypto.

## Run locally

Serve `src/main/resources/static` as a static directory using any local web server, then open its `index.html`. For product details, open `product.html?id=p-001`; Vercel additionally rewrites `/products/p-001` to that page.

## Demo account

- Admin: `admin@zalastore.az` / `admin123`
- Customers can register, edit their profile, browse products, add items to their cart, and complete demo orders.
- Admins can manage products and customers, create staff accounts, view sales, and export reports.

## JavaScript business logic

`store-service.js` contains the former Spring service rules: validation, role-based page access, catalog search, stock checks and updates, account/profile operations, cart totals, checkout, inventory, sales filtering, reports, top-five product ranking, and CSV export. `app.js` handles page rendering, navigation, browser storage, and user interaction.

## Preserved Spring Boot version

The Spring Boot/Maven project as it existed before this migration is copied to `spring-boot-backup/`. It can be run independently from that folder with:

```powershell
cd spring-boot-backup
.\mvnw.cmd spring-boot:run
```

## Limitations

This Vercel build is a client-side demo, not a trusted production backend. `localStorage` is editable by its user and isolated to one browser; accounts, role claims, inventory, and sales do not sync across devices. Client-side password hashing and role checks do not establish server-side identity or authorization. Do not use real customer information, passwords, payments, or shared inventory without adding a trusted serverless API and database.
