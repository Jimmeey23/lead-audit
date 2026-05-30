import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const outputDir = resolve(root, ".vercel/output");

await rm(outputDir, { recursive: true, force: true });
await mkdir(resolve(outputDir, "static"), { recursive: true });
await mkdir(resolve(outputDir, "functions/__server.func"), { recursive: true });

await cp(resolve(distDir, "client"), resolve(outputDir, "static"), {
  recursive: true,
});
await cp(resolve(distDir, "server"), resolve(outputDir, "functions/__server.func"), {
  recursive: true,
});
await cp(resolve(distDir, "config.json"), resolve(outputDir, "config.json"));

