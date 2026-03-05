import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli.js");
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const propertiesFixture = JSON.parse(
  readFileSync(path.join(repoRoot, "test", "fixtures", "properties.json"), "utf8"),
);
const bookingsFixture = JSON.parse(
  readFileSync(path.join(repoRoot, "test", "fixtures", "bookings.json"), "utf8"),
);

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    input: options.input,
    encoding: "utf8",
    env: {
      ...process.env,
      ...options.env,
    },
  });
}

function runCliAsync(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: options.cwd ?? repoRoot,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status, signal) => {
      resolve({ status, signal, stdout, stderr });
    });

    if (options.input !== undefined) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}

async function withStubServer(routes, run) {
  const server = createServer((req, res) => {
    const key = `${req.method} ${new URL(req.url, "http://127.0.0.1").pathname}`;
    const route = routes[key];

    if (!route) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: `No fixture route for ${key}` }));
      return;
    }

    res.writeHead(route.status ?? 200, { "content-type": "application/json" });
    res.end(JSON.stringify(route.body));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Unable to determine stub server address");
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("global help lists completion commands and output flags", () => {
  const result = runCli(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /completion/);
  assert.match(result.stdout, /--fields/);
  assert.match(result.stdout, /--ndjson/);
  assert.match(result.stdout, /--compact/);
});

test("version prints package version", () => {
  const result = runCli(["--version"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), packageJson.version);
});

test("completion bash prints raw script by default", () => {
  const result = runCli(["completion", "bash"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /complete -F _zafari_completion zafari/);
});

test("completion scripts include command-specific flags", () => {
  const result = runCli(["completion", "bash"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /"rooms rates"\)/);
  assert.match(result.stdout, /--resident-type/);
  assert.match(result.stdout, /--room-id/);
});

test("completion bash supports JSON field selection", () => {
  const result = runCli(["completion", "bash", "--json", "--fields", "shell"]);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { shell: "bash" });
});

test("completion bash supports ndjson with selected array field", () => {
  const result = runCli(["completion", "bash", "--json", "--fields", "commands", "--ndjson"]);
  assert.equal(result.status, 0);
  const lines = result.stdout.trim().split("\n");
  assert.ok(lines.length > 3);
  assert.ok(lines.some((line) => line === "\"rooms rates\""));
});

test("bookings create accepts @file input alias and validates JSON before API calls", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "zafari-cli-"));
  const inputPath = path.join(tempDir, "booking.json");
  writeFileSync(inputPath, JSON.stringify({ check_in: "2026-04-10" }));

  const result = runCli(
    ["bookings", "create", "--property-id", "prop_123", "--input", `@${inputPath}`],
    { cwd: tempDir, env: { ZAFARI_API_KEY: "" } },
  );

  assert.equal(result.status, 1);
  const error = JSON.parse(result.stderr);
  assert.equal(error.error, "validation_error");
  assert.ok(error.details.some((detail) => detail.path === "check_out"));
});

test("properties list supports compact JSON output against fixture server", async () => {
  await withStubServer(
    {
      "GET /properties": { body: propertiesFixture },
    },
    async (baseUrl) => {
      const result = await runCliAsync(
        ["properties", "list", "--base-url", baseUrl, "--api-key", "test-key", "--compact"],
        { cwd: tmpdir() },
      );

      assert.equal(result.status, 0);
      assert.ok(result.stdout.trim().startsWith("{\"properties\":"));
      assert.equal(result.stdout.includes("\n  "), false);
      assert.equal(JSON.parse(result.stdout).properties[0].name, "Savanna Lodge");
    },
  );
});

test("properties list renders markdown against fixture server", async () => {
  await withStubServer(
    {
      "GET /properties": { body: propertiesFixture },
    },
    async (baseUrl) => {
      const result = await runCliAsync(
        ["properties", "list", "--base-url", baseUrl, "--api-key", "test-key", "--markdown"],
        { cwd: tmpdir() },
      );

      assert.equal(result.status, 0);
      assert.match(result.stdout, /## Savanna Lodge/);
      assert.match(result.stdout, /\*\*ID:\*\* prop_123/);
    },
  );
});

test("bookings list supports fields and ndjson against fixture server", async () => {
  await withStubServer(
    {
      "GET /properties/prop_123/bookings": { body: bookingsFixture },
    },
    async (baseUrl) => {
      const result = await runCliAsync(
        [
          "bookings",
          "list",
          "--property-id",
          "prop_123",
          "--base-url",
          baseUrl,
          "--api-key",
          "test-key",
          "--fields",
          "bookings.reference",
          "--ndjson",
        ],
        { cwd: tmpdir() },
      );

      assert.equal(result.status, 0);
      assert.deepEqual(result.stdout.trim().split("\n"), ['"BK-001"', '"BK-002"']);
    },
  );
});
