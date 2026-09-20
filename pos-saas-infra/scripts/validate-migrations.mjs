import { readdir } from "node:fs/promises";
import { join } from "node:path";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const files = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  throw new Error("No se encontraron migraciones SQL");
}

const versions = files.map((file) => file.split("_")[0]);
if (new Set(versions).size !== versions.length) {
  throw new Error("Hay versiones de migración duplicadas");
}

if (files.some((file, index) => index > 0 && file <= files[index - 1])) {
  throw new Error("Las migraciones no tienen un orden lexicográfico estable");
}

console.log(`Migraciones válidas: ${files.length}`);
