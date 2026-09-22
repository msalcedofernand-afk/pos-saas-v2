import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);

function option(name, fallback = undefined) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function redact(value, secret) {
  if (!secret) return value;
  return value.replaceAll(secret, "[redacted]");
}

function run(command, commandArgs, { secret } = {}) {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(command, commandArgs, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolveProcess(stdout);
      const detail = redact(stderr.trim().slice(-2000), secret ?? "");
      reject(new Error(`${command} terminó con código ${code}${detail ? `: ${detail}` : ""}`));
    });
  });
}

function executable(name) {
  return process.platform === "win32" ? `${name}.exe` : name;
}

function npxExecutable() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

async function sha256(file) {
  const hash = createHash("sha256");
  await new Promise((resolveHash, reject) => {
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolveHash);
  });
  return hash.digest("hex");
}

async function psql(databaseUrl, query) {
  const output = await run(
    executable("psql"),
    ["--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-At", "-c", query, databaseUrl],
    { secret: databaseUrl },
  );
  return output.trim();
}

function countsQuery() {
  return `
    SELECT json_build_object(
      'organizations', (SELECT count(*) FROM public.organizations),
      'users', (SELECT count(*) FROM public.users),
      'organization_members', (SELECT count(*) FROM public.organization_members),
      'orders', (SELECT count(*) FROM public.orders)
    )::text;
  `;
}

async function readCounts(databaseUrl) {
  const output = await psql(databaseUrl, countsQuery());
  try {
    return JSON.parse(output);
  } catch {
    throw new Error("psql no devolvió un JSON válido para la verificación de conteos");
  }
}

async function backup() {
  const sourceUrl = requiredEnv("SOURCE_DATABASE_URL");
  const sourceProjectRef = option("source-project-ref");
  if (!sourceProjectRef) throw new Error("Falta --source-project-ref");

  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const outputDirectory = resolve(option("output-dir", join(process.cwd(), "backups", `phase6-${timestamp}`)));
  await mkdir(outputDirectory, { recursive: true });

  const counts = await readCounts(sourceUrl);
  const dumpFile = join(outputDirectory, "database.sql");
  await run(npxExecutable(), ["--no-install", "supabase", "db", "dump", "--db-url", sourceUrl, "--file", dumpFile], {
    secret: sourceUrl,
  });

  const manifest = {
    format: "mesa-clara-phase6-backup-v1",
    sourceProjectRef,
    createdAt: new Date().toISOString(),
    gitCommit: process.env.GITHUB_SHA ?? "local",
    migration: process.env.PHASE6_MIGRATION ?? "not-specified",
    dumpFile: "database.sql",
    sizeBytes: (await stat(dumpFile)).size,
    sha256: await sha256(dumpFile),
    counts,
  };
  await writeFile(join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Backup creado en ${outputDirectory}`);
  console.log(`SHA-256: ${manifest.sha256}`);
}

async function restore() {
  const targetUrl = requiredEnv("TARGET_DATABASE_URL");
  const targetProjectRef = option("target-project-ref");
  const backupDirectory = option("backup-dir");
  if (!targetProjectRef) throw new Error("Falta --target-project-ref");
  if (!backupDirectory) throw new Error("Falta --backup-dir");
  if (process.env.PHASE6_RESTORE_CONFIRMATION !== "RESTORE_TO_TEST_ONLY") {
    throw new Error("Define PHASE6_RESTORE_CONFIRMATION=RESTORE_TO_TEST_ONLY para permitir una restauración");
  }

  const manifestPath = join(resolve(backupDirectory), "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.sourceProjectRef === targetProjectRef) {
    throw new Error(
      "El destino coincide con el proyecto origen; la restauración solo puede ir a un proyecto de prueba distinto",
    );
  }
  const dumpFile = join(resolve(backupDirectory), manifest.dumpFile);
  const actualHash = await sha256(dumpFile);
  if (actualHash !== manifest.sha256) throw new Error("El hash del backup no coincide con el manifest");

  await run(executable("psql"), ["--no-psqlrc", "-v", "ON_ERROR_STOP=1", "--file", dumpFile, targetUrl], {
    secret: targetUrl,
  });
  const restoredCounts = await readCounts(targetUrl);
  for (const key of Object.keys(manifest.counts)) {
    if (Number(restoredCounts[key]) !== Number(manifest.counts[key])) {
      throw new Error(
        `La restauración no coincide en ${key}: esperado ${manifest.counts[key]}, recibido ${restoredCounts[key]}`,
      );
    }
  }

  const verification = {
    format: "mesa-clara-phase6-restore-verification-v1",
    verifiedAt: new Date().toISOString(),
    sourceProjectRef: manifest.sourceProjectRef,
    targetProjectRef,
    backupSha256: manifest.sha256,
    counts: restoredCounts,
    result: "verified",
  };
  await writeFile(
    join(resolve(backupDirectory), "restore-verification.json"),
    `${JSON.stringify(verification, null, 2)}\n`,
    "utf8",
  );
  console.log(`Restauración verificada en ${targetProjectRef}`);
}

if (args.includes("--help") || args.length === 0) {
  console.log(
    `Uso:\n  node scripts/backup-and-restore.mjs --mode backup --source-project-ref <ref> [--output-dir <dir>]\n  node scripts/backup-and-restore.mjs --mode restore --target-project-ref <ref> --backup-dir <dir>`,
  );
  process.exit(args.length === 0 ? 2 : 0);
}

const mode = option("mode");
try {
  if (mode === "backup") await backup();
  else if (mode === "restore") await restore();
  else throw new Error("--mode debe ser backup o restore");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
