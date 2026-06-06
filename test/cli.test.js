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
    input: options.input,
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
  assert.equal(parsed.error.code, "SLE_NOT_INITIALIZED");
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

test("creates and lists named profiles", async () => {
  const sleHome = await createInstalledSleHome();

  const created = run(["profile", "create", "research"], { env: { SLE_HOME: sleHome } });
  assert.equal(created.status, 0);
  assert.match(created.stdout, /Created profile 'research'/);

  await assertPathExists(path.join(sleHome, "research", "SOUL.md"));
  await assertPathExists(path.join(sleHome, "research", "memories", "MEMORY.md"));
  await assertPathExists(path.join(sleHome, "research", "memories", "USER.md"));
  await assertPathExists(path.join(sleHome, "research", "skills", ".usage.json"));

  const listed = run(["profile", "list", "--json"], { env: { SLE_HOME: sleHome } });
  assert.equal(listed.status, 0);

  const parsed = JSON.parse(listed.stdout);
  assert.deepEqual(parsed, {
    ok: true,
    data: {
      profiles: [
        {
          name: "default",
          path: path.join(sleHome, "default"),
          isDefault: true,
        },
        {
          name: "research",
          path: path.join(sleHome, "research"),
          isDefault: false,
        },
      ],
      defaultProfile: "default",
    },
  });
});

test("returns profile directory using explicit or default resolution", async () => {
  const sleHome = await createInstalledSleHome();
  run(["profile", "create", "research"], { env: { SLE_HOME: sleHome } });

  const explicitResult = run(["profile", "dir", "research"], { env: { SLE_HOME: sleHome } });
  assert.equal(explicitResult.status, 0);
  assert.equal(explicitResult.stdout.trim(), path.join(sleHome, "research"));

  const defaultResult = run(["profile", "dir"], { env: { SLE_HOME: sleHome } });
  assert.equal(defaultResult.status, 0);
  assert.equal(defaultResult.stdout.trim(), path.join(sleHome, "default"));
});

test("sets and gets the default profile", async () => {
  const sleHome = await createInstalledSleHome();
  run(["profile", "create", "research"], { env: { SLE_HOME: sleHome } });

  const setDefaultResult = run(["profile", "set-default", "research", "--json"], {
    env: { SLE_HOME: sleHome },
  });
  assert.equal(setDefaultResult.status, 0);

  const setDefaultParsed = JSON.parse(setDefaultResult.stdout);
  assert.equal(setDefaultParsed.ok, true);
  assert.equal(setDefaultParsed.data.defaultProfile, "research");

  const getDefaultResult = run(["profile", "get-default"], { env: { SLE_HOME: sleHome } });
  assert.equal(getDefaultResult.status, 0);
  assert.equal(getDefaultResult.stdout.trim(), "research");

  const config = JSON.parse(await fs.readFile(path.join(sleHome, "config.json"), "utf8"));
  assert.equal(config.defaultProfile, "research");
});

test("refuses to delete the current default profile", async () => {
  const sleHome = await createInstalledSleHome();

  const result = run(["profile", "delete", "default", "--yes"], { env: { SLE_HOME: sleHome } });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /DEFAULT_PROFILE_DELETE_FORBIDDEN/);
  await assertPathExists(path.join(sleHome, "default"));
});

test("deletes a non-default profile with explicit confirmation", async () => {
  const sleHome = await createInstalledSleHome();
  run(["profile", "create", "research"], { env: { SLE_HOME: sleHome } });

  const result = run(["profile", "delete", "research", "--yes", "--json"], {
    env: { SLE_HOME: sleHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.deletedProfile, "research");

  await assert.rejects(fs.access(path.join(sleHome, "research")));
});

test("views and edits soul content from file and stdin", async () => {
  const sleHome = await createInstalledSleHome();
  run(["profile", "create", "research"], { env: { SLE_HOME: sleHome } });

  const initialView = run(["soul", "view", "research", "--json"], { env: { SLE_HOME: sleHome } });
  assert.equal(initialView.status, 0);
  assert.deepEqual(JSON.parse(initialView.stdout), {
    ok: true,
    data: {
      profile: "research",
      path: path.join(sleHome, "research", "SOUL.md"),
      raw: "# SOUL\n",
    },
  });

  const sourcePath = path.join(sleHome, "next-soul.md");
  await fs.writeFile(sourcePath, "# SOUL\n\nResearch profile for infrastructure work.\n", "utf8");

  const fileEdit = run(["soul", "edit", "research", "--file", sourcePath], {
    env: { SLE_HOME: sleHome },
  });
  assert.equal(fileEdit.status, 0);
  assert.match(fileEdit.stdout, /Updated SOUL\.md for profile 'research'/);

  const stdinEdit = run(["soul", "edit", "--stdin", "--json"], {
    env: { SLE_HOME: sleHome },
    input: "# SOUL\n\nDefault profile for quick notes.\n",
  });
  assert.equal(stdinEdit.status, 0);
  const stdinParsed = JSON.parse(stdinEdit.stdout);
  assert.equal(stdinParsed.ok, true);
  assert.equal(stdinParsed.data.profile, "default");
  assert.equal(stdinParsed.data.source, "stdin");
  assert.equal(stdinParsed.data.raw, "# SOUL\n\nDefault profile for quick notes.\n");

  const researchSoul = await fs.readFile(path.join(sleHome, "research", "SOUL.md"), "utf8");
  assert.equal(researchSoul, "# SOUL\n\nResearch profile for infrastructure work.\n");

  const defaultSoul = await fs.readFile(path.join(sleHome, "default", "SOUL.md"), "utf8");
  assert.equal(defaultSoul, "# SOUL\n\nDefault profile for quick notes.\n");
});

test("requires exactly one soul edit input source", async () => {
  const sleHome = await createInstalledSleHome();
  const sourcePath = path.join(sleHome, "next-soul.md");
  await fs.writeFile(sourcePath, "# SOUL\n\nProfile.\n", "utf8");

  const missingInput = run(["soul", "edit", "--json"], { env: { SLE_HOME: sleHome } });
  assert.equal(missingInput.status, 2);
  assert.equal(JSON.parse(missingInput.stdout).error.code, "INVALID_SOUL_INPUT");

  const duplicateInput = run(["soul", "edit", "--file", sourcePath, "--stdin", "--json"], {
    env: { SLE_HOME: sleHome },
    input: "# SOUL\n\nConflicting input.\n",
  });
  assert.equal(duplicateInput.status, 2);
  assert.equal(JSON.parse(duplicateInput.stdout).error.code, "INVALID_SOUL_INPUT");
});

test("adds, lists, views, replaces, and removes memory entries", async () => {
  const sleHome = await createInstalledSleHome();
  run(["profile", "create", "research"], { env: { SLE_HOME: sleHome } });

  const addMemory = run(
    ["memory", "add", "research", "--target", "memory", "--entry", "Postgres runs locally"],
    { env: { SLE_HOME: sleHome } },
  );
  assert.equal(addMemory.status, 0);

  const addUser = run(
    ["memory", "add", "--target", "user", "--entry", "Prefers concise answers"],
    { env: { SLE_HOME: sleHome } },
  );
  assert.equal(addUser.status, 0);

  const listed = run(["memory", "list", "research", "--json"], { env: { SLE_HOME: sleHome } });
  assert.equal(listed.status, 0);
  assert.deepEqual(JSON.parse(listed.stdout), {
    ok: true,
    data: {
      profile: "research",
      targets: [
        {
          target: "memory",
          entryCount: 1,
          entries: ["Postgres runs locally"],
        },
        {
          target: "user",
          entryCount: 0,
          entries: [],
        },
      ],
    },
  });

  const userView = run(["memory", "view", "--target", "user", "--json"], {
    env: { SLE_HOME: sleHome },
  });
  assert.equal(userView.status, 0);
  const viewed = JSON.parse(userView.stdout);
  assert.equal(viewed.ok, true);
  assert.equal(viewed.data.profile, "default");
  assert.equal(viewed.data.target, "user");
  assert.deepEqual(viewed.data.entries, ["Prefers concise answers"]);
  assert.match(viewed.data.raw, /^# USER\n\nPrefers concise answers\n$/);

  const replaceResult = run(
    ["memory", "replace", "--target", "user", "--match", "concise", "--entry", "Prefers detailed answers"],
    { env: { SLE_HOME: sleHome } },
  );
  assert.equal(replaceResult.status, 0);

  const removeResult = run(
    ["memory", "remove", "--target", "user", "--match", "detailed"],
    { env: { SLE_HOME: sleHome } },
  );
  assert.equal(removeResult.status, 0);

  const usage = JSON.parse(
    await fs.readFile(path.join(sleHome, "default", "skills", ".usage.json"), "utf8"),
  );
  assert.equal(usage.memory.lastModifiedTarget, "user");
  assert.equal(usage.memory.lastOperation, "remove");
  assert.equal(usage.memory.targets.user.entryCount, 0);
  assert.ok(usage.memory.lastOperationAt);
});

test("rejects duplicate memory entries", async () => {
  const sleHome = await createInstalledSleHome();

  const first = run(
    ["memory", "add", "--target", "memory", "--entry", "The API runs in us-east-1"],
    { env: { SLE_HOME: sleHome } },
  );
  assert.equal(first.status, 0);

  const duplicate = run(
    ["memory", "add", "--target", "memory", "--entry", "The API runs in us-east-1", "--json"],
    { env: { SLE_HOME: sleHome } },
  );
  assert.equal(duplicate.status, 2);

  const parsed = JSON.parse(duplicate.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, "MEMORY_ENTRY_ALREADY_EXISTS");
});

test("fails explicitly when memory matches are missing or ambiguous", async () => {
  const sleHome = await createInstalledSleHome();

  run(["memory", "add", "--target", "memory", "--entry", "Primary API endpoint"], {
    env: { SLE_HOME: sleHome },
  });
  run(["memory", "add", "--target", "memory", "--entry", "Primary API token"], {
    env: { SLE_HOME: sleHome },
  });

  const ambiguous = run(
    ["memory", "replace", "--target", "memory", "--match", "Primary API", "--entry", "Updated"],
    { env: { SLE_HOME: sleHome } },
  );
  assert.equal(ambiguous.status, 1);
  assert.match(ambiguous.stderr, /MEMORY_ENTRY_AMBIGUOUS/);

  const missing = run(
    ["memory", "remove", "--target", "memory", "--match", "does not exist", "--json"],
    { env: { SLE_HOME: sleHome } },
  );
  assert.equal(missing.status, 1);
  const parsed = JSON.parse(missing.stdout);
  assert.equal(parsed.error.code, "MEMORY_ENTRY_NOT_FOUND");
});

async function createTempSleHome() {
  return fs.mkdtemp(path.join(os.tmpdir(), "sle-test-"));
}

async function createInstalledSleHome() {
  const sleHome = await createTempSleHome();
  const result = run(["install"], { env: { SLE_HOME: sleHome } });
  assert.equal(result.status, 0);
  return sleHome;
}

async function assertPathExists(targetPath) {
  await fs.access(targetPath);
}
