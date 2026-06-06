const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("path");
const { spawnSync } = require("node:child_process");

const cliPath = path.join(__dirname, "..", "bin", "sle.js");

function run(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...options.env,
    },
  });
}

test("prints top-level help", () => {
  const result = run(["help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Profile-scoped memory and skills CLI for agents\./);
  assert.match(result.stdout, /Examples:/);
  assert.match(result.stdout, /sle install/);
});

test("prints focused command help", () => {
  const result = run(["help", "profile", "create"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Create a named profile\./);
  assert.match(result.stdout, /sle profile create research/);
});

test("returns machine-readable JSON errors", () => {
  const result = run(["profile", "list", "--json"]);

  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed.ok, false);
  assert.equal(parsed.error.code, "NOT_IMPLEMENTED");
});

test("validates names with explicit errors", () => {
  const result = run(["profile", "create", "../bad"]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /INVALID_PROFILE_NAME/);
});

test("bootstraps SLE home on install", async () => {
  const sleHome = await createTempSleHome();

  const result = run(["install"], { env: { SLE_HOME: sleHome } });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Initialized SLE/);

  const config = JSON.parse(await fs.readFile(path.join(sleHome, "config.json"), "utf8"));
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.defaultProfile, "default");
  assert.deepEqual(config.hosts, {});

  await assertPathExists(path.join(sleHome, "default", "SOUL.md"));
  await assertPathExists(path.join(sleHome, "default", "memories", "MEMORY.md"));
  await assertPathExists(path.join(sleHome, "default", "memories", "USER.md"));
  await assertPathExists(path.join(sleHome, "default", "skills", ".usage.json"));
});

test("rerunning install is idempotent", async () => {
  const sleHome = await createTempSleHome();

  const first = run(["install", "--json"], { env: { SLE_HOME: sleHome } });
  assert.equal(first.status, 0);

  const second = run(["install", "--json"], { env: { SLE_HOME: sleHome } });
  assert.equal(second.status, 0);

  const parsed = JSON.parse(second.stdout);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data.created.directories, []);
  assert.deepEqual(parsed.data.created.files, []);
});

test("schema mismatch is rejected before command execution", async () => {
  const sleHome = await createTempSleHome();
  await fs.mkdir(sleHome, { recursive: true });
  await fs.writeFile(
    path.join(sleHome, "config.json"),
    `${JSON.stringify({ schemaVersion: 999, defaultProfile: "default", hosts: {} }, null, 2)}\n`,
    "utf8",
  );

  const result = run(["profile", "list"], { env: { SLE_HOME: sleHome } });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /SCHEMA_MIGRATION_REQUIRED/);
});

async function createTempSleHome() {
  return fs.mkdtemp(path.join(os.tmpdir(), "sle-test-"));
}

async function assertPathExists(targetPath) {
  await fs.access(targetPath);
}
