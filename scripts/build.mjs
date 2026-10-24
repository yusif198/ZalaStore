import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const source = resolve(root, "src/main/resources/static");
const output = resolve(root, "dist");

if (!existsSync(resolve(source, "index.html")) || !existsSync(resolve(source, "app.js")) ||
    !existsSync(resolve(source, "store-service.js"))) {
  throw new Error("Static storefront files are missing from src/main/resources/static.");
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(source, output, { recursive: true });
const productTemplate = readFileSync(resolve(source, "product.html"), "utf8");
const productIds = [...readFileSync(resolve(source, "store-service.js"), "utf8").matchAll(/\{ id: "(p-\d{3})"/g)]
  .map(([, productId]) => productId);
const productRoutes = resolve(output, "products");
mkdirSync(productRoutes, { recursive: true });
productIds.forEach((productId) => {
  writeFileSync(resolve(productRoutes, `${productId}.html`), productTemplate);
});
console.log(`Built static storefront into ${output}`);
