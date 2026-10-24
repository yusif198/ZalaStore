import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
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
console.log(`Built static storefront into ${output}`);
