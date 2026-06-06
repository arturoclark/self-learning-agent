const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.join(__dirname, "..");
const cliPath = path.join(__dirname, "..", "bin", "sla.js");

function run(args, options = {}) {
  return runCommand(process.execPath, [cliPath, ...args], options);
}

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    cwd: options.cwd || repoRoot,
    input: options.input,
    env: {
      ...process.env,
      ...options.env,
    },
  });
}

function runExternal(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    cwd: options.cwd || repoRoot,
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
  assert.match(result.stdout, /sla install/);
});

test("prints focused command help", () => {
  const result = run(["help", "profile", "create"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Create a named profile\./);
  assert.match(result.stdout, /sla profile create research/);
});

test("returns machine-readable JSON errors", () => {
  const result = run(["profile", "list", "--json"]);

  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed.ok, false);
  assert.equal(parsed.error.code, "SLA_NOT_INITIALIZED");
});

test("validates names with explicit errors", () => {
  const result = run(["profile", "create", "../bad"]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /INVALID_PROFILE_NAME/);
});

test("bootstraps SLA home on install", async () => {
  const slaHome = await createTempSlaHome();

  const result = run(["install"], { env: { SLA_HOME: slaHome } });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Initialized SLA/);

  const config = JSON.parse(await fs.readFile(path.join(slaHome, "config.json"), "utf8"));
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.defaultProfile, "default");
  assert.deepEqual(config.hosts, {});

  await assertPathExists(path.join(slaHome, "default", "SOUL.md"));
  await assertPathExists(path.join(slaHome, "default", "memories", "MEMORY.md"));
  await assertPathExists(path.join(slaHome, "default", "memories", "USER.md"));
  await assertPathExists(path.join(slaHome, "default", "skills", ".usage.json"));
});

test("rerunning install is idempotent", async () => {
  const slaHome = await createTempSlaHome();

  const first = run(["install", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(first.status, 0);

  const second = run(["install", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(second.status, 0);

  const parsed = JSON.parse(second.stdout);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data.created.directories, []);
  assert.deepEqual(parsed.data.created.files, []);
});

test("schema mismatch is rejected before command execution", async () => {
  const slaHome = await createTempSlaHome();
  await fs.mkdir(slaHome, { recursive: true });
  await fs.writeFile(
    path.join(slaHome, "config.json"),
    `${JSON.stringify({ schemaVersion: 999, defaultProfile: "default", hosts: {} }, null, 2)}\n`,
    "utf8",
  );

  const result = run(["profile", "list"], { env: { SLA_HOME: slaHome } });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /SCHEMA_MIGRATION_REQUIRED/);
});

test("creates and lists named profiles", async () => {
  const slaHome = await createInstalledSlaHome();

  const created = run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });
  assert.equal(created.status, 0);
  assert.match(created.stdout, /Created profile 'research'/);

  await assertPathExists(path.join(slaHome, "research", "SOUL.md"));
  await assertPathExists(path.join(slaHome, "research", "memories", "MEMORY.md"));
  await assertPathExists(path.join(slaHome, "research", "memories", "USER.md"));
  await assertPathExists(path.join(slaHome, "research", "skills", ".usage.json"));

  const listed = run(["profile", "list", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(listed.status, 0);

  const parsed = JSON.parse(listed.stdout);
  assert.deepEqual(parsed, {
    ok: true,
    data: {
      profiles: [
        {
          name: "default",
          path: path.join(slaHome, "default"),
          isDefault: true,
        },
        {
          name: "research",
          path: path.join(slaHome, "research"),
          isDefault: false,
        },
      ],
      defaultProfile: "default",
    },
  });
});

test("returns profile directory using explicit or default resolution", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const explicitResult = run(["profile", "dir", "research"], { env: { SLA_HOME: slaHome } });
  assert.equal(explicitResult.status, 0);
  assert.equal(explicitResult.stdout.trim(), path.join(slaHome, "research"));

  const defaultResult = run(["profile", "dir"], { env: { SLA_HOME: slaHome } });
  assert.equal(defaultResult.status, 0);
  assert.equal(defaultResult.stdout.trim(), path.join(slaHome, "default"));
});

test("sets and gets the default profile", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const setDefaultResult = run(["profile", "set-default", "research", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(setDefaultResult.status, 0);

  const setDefaultParsed = JSON.parse(setDefaultResult.stdout);
  assert.equal(setDefaultParsed.ok, true);
  assert.equal(setDefaultParsed.data.defaultProfile, "research");

  const getDefaultResult = run(["profile", "get-default"], { env: { SLA_HOME: slaHome } });
  assert.equal(getDefaultResult.status, 0);
  assert.equal(getDefaultResult.stdout.trim(), "research");

  const config = JSON.parse(await fs.readFile(path.join(slaHome, "config.json"), "utf8"));
  assert.equal(config.defaultProfile, "research");
});

test("refuses to delete the current default profile", async () => {
  const slaHome = await createInstalledSlaHome();

  const result = run(["profile", "delete", "default", "--yes"], { env: { SLA_HOME: slaHome } });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /DEFAULT_PROFILE_DELETE_FORBIDDEN/);
  await assertPathExists(path.join(slaHome, "default"));
});

test("deletes a non-default profile with explicit confirmation", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const result = run(["profile", "delete", "research", "--yes", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.deletedProfile, "research");

  await assert.rejects(fs.access(path.join(slaHome, "research")));
});

test("views and edits soul content from file and stdin", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const initialView = run(["soul", "view", "research", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(initialView.status, 0);
  assert.deepEqual(JSON.parse(initialView.stdout), {
    ok: true,
    data: {
      profile: "research",
      path: path.join(slaHome, "research", "SOUL.md"),
      raw: "# SOUL\n",
    },
  });

  const sourcePath = path.join(slaHome, "next-soul.md");
  await fs.writeFile(sourcePath, "# SOUL\n\nResearch profile for infrastructure work.\n", "utf8");

  const fileEdit = run(["soul", "edit", "research", "--file", sourcePath], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(fileEdit.status, 0);
  assert.match(fileEdit.stdout, /Updated SOUL\.md for profile 'research'/);

  const stdinEdit = run(["soul", "edit", "--stdin", "--json"], {
    env: { SLA_HOME: slaHome },
    input: "# SOUL\n\nDefault profile for quick notes.\n",
  });
  assert.equal(stdinEdit.status, 0);
  const stdinParsed = JSON.parse(stdinEdit.stdout);
  assert.equal(stdinParsed.ok, true);
  assert.equal(stdinParsed.data.profile, "default");
  assert.equal(stdinParsed.data.source, "stdin");
  assert.equal(stdinParsed.data.raw, "# SOUL\n\nDefault profile for quick notes.\n");

  const researchSoul = await fs.readFile(path.join(slaHome, "research", "SOUL.md"), "utf8");
  assert.equal(researchSoul, "# SOUL\n\nResearch profile for infrastructure work.\n");

  const defaultSoul = await fs.readFile(path.join(slaHome, "default", "SOUL.md"), "utf8");
  assert.equal(defaultSoul, "# SOUL\n\nDefault profile for quick notes.\n");
});

test("requires exactly one soul edit input source", async () => {
  const slaHome = await createInstalledSlaHome();
  const sourcePath = path.join(slaHome, "next-soul.md");
  await fs.writeFile(sourcePath, "# SOUL\n\nProfile.\n", "utf8");

  const missingInput = run(["soul", "edit", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(missingInput.status, 2);
  assert.equal(JSON.parse(missingInput.stdout).error.code, "INVALID_SOUL_INPUT");

  const duplicateInput = run(["soul", "edit", "--file", sourcePath, "--stdin", "--json"], {
    env: { SLA_HOME: slaHome },
    input: "# SOUL\n\nConflicting input.\n",
  });
  assert.equal(duplicateInput.status, 2);
  assert.equal(JSON.parse(duplicateInput.stdout).error.code, "INVALID_SOUL_INPUT");
});

test("adds, lists, views, replaces, and removes memory entries", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const addMemory = run(
    ["memory", "add", "research", "--target", "memory", "--entry", "Postgres runs locally"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(addMemory.status, 0);

  const addUser = run(
    ["memory", "add", "--target", "user", "--entry", "Prefers concise answers"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(addUser.status, 0);

  const listed = run(["memory", "list", "research", "--json"], { env: { SLA_HOME: slaHome } });
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
    env: { SLA_HOME: slaHome },
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
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(replaceResult.status, 0);

  const removeResult = run(
    ["memory", "remove", "--target", "user", "--match", "detailed"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(removeResult.status, 0);

  const usage = JSON.parse(
    await fs.readFile(path.join(slaHome, "default", "skills", ".usage.json"), "utf8"),
  );
  assert.equal(usage.memory.lastModifiedTarget, "user");
  assert.equal(usage.memory.lastOperation, "remove");
  assert.equal(usage.memory.targets.user.entryCount, 0);
  assert.ok(usage.memory.lastOperationAt);
});

test("rejects duplicate memory entries", async () => {
  const slaHome = await createInstalledSlaHome();

  const first = run(
    ["memory", "add", "--target", "memory", "--entry", "The API runs in us-east-1"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(first.status, 0);

  const duplicate = run(
    ["memory", "add", "--target", "memory", "--entry", "The API runs in us-east-1", "--json"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(duplicate.status, 2);

  const parsed = JSON.parse(duplicate.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, "MEMORY_ENTRY_ALREADY_EXISTS");
});

test("fails explicitly when memory matches are missing or ambiguous", async () => {
  const slaHome = await createInstalledSlaHome();

  run(["memory", "add", "--target", "memory", "--entry", "Primary API endpoint"], {
    env: { SLA_HOME: slaHome },
  });
  run(["memory", "add", "--target", "memory", "--entry", "Primary API token"], {
    env: { SLA_HOME: slaHome },
  });

  const ambiguous = run(
    ["memory", "replace", "--target", "memory", "--match", "Primary API", "--entry", "Updated"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(ambiguous.status, 1);
  assert.match(ambiguous.stderr, /MEMORY_ENTRY_AMBIGUOUS/);

  const missing = run(
    ["memory", "remove", "--target", "memory", "--match", "does not exist", "--json"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(missing.status, 1);
  const parsed = JSON.parse(missing.stdout);
  assert.equal(parsed.error.code, "MEMORY_ENTRY_NOT_FOUND");
});

test("creates, lists, views, edits, and deletes skills", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const created = run(["skill", "create", "deploy", "research", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(created.status, 0);
  const createdParsed = JSON.parse(created.stdout);
  assert.equal(createdParsed.ok, true);
  assert.equal(createdParsed.data.skill, "deploy");
  assert.equal(createdParsed.data.metadata.name, "deploy");

  const listed = run(["skill", "list", "research", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(listed.status, 0);
  assert.deepEqual(JSON.parse(listed.stdout), {
    ok: true,
    data: {
      profile: "research",
      skills: [
        {
          skill: "deploy",
          name: "deploy",
          description: "TODO: describe this skill.",
          path: path.join(slaHome, "research", "skills", "deploy", "SKILL.md"),
        },
      ],
    },
  });

  const viewed = run(["skill", "view", "deploy", "research", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(viewed.status, 0);
  const viewedParsed = JSON.parse(viewed.stdout);
  assert.equal(viewedParsed.ok, true);
  assert.equal(viewedParsed.data.metadata.name, "deploy");
  assert.match(viewedParsed.data.raw, /^---\nname: deploy\n/);

  const nextSkillPath = path.join(slaHome, "deploy-skill.md");
  await fs.writeFile(
    nextSkillPath,
    ["---", "name: deploy", "description: Deploys the API.", "---", "", "# Deploy", "", "Run the release flow.", ""].join("\n"),
    "utf8",
  );

  const edited = run(["skill", "edit", "deploy", "research", "--file", nextSkillPath], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(edited.status, 0);
  assert.match(edited.stdout, /Updated SKILL\.md/);

  const deleted = run(["skill", "delete", "deploy", "research", "--yes", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(deleted.status, 0);
  const deletedParsed = JSON.parse(deleted.stdout);
  assert.equal(deletedParsed.ok, true);
  assert.equal(deletedParsed.data.deletedSkill, "deploy");

  await assert.rejects(fs.access(path.join(slaHome, "research", "skills", "deploy", "SKILL.md")));

  const usage = JSON.parse(
    await fs.readFile(path.join(slaHome, "research", "skills", ".usage.json"), "utf8"),
  );
  assert.equal(usage.skills.deploy, undefined);
});

test("writes and removes managed skill files in allowed subdirectories", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["skill", "create", "deploy"], { env: { SLA_HOME: slaHome } });

  const scriptPath = path.join(slaHome, "check.sh");
  await fs.writeFile(scriptPath, "#!/bin/sh\necho ok\n", "utf8");

  const wrote = run(
    ["skill", "write-file", "deploy", "--subdir", "scripts", "--path", "check.sh", "--file", scriptPath, "--json"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(wrote.status, 0);
  const wroteParsed = JSON.parse(wrote.stdout);
  assert.equal(wroteParsed.ok, true);
  assert.equal(wroteParsed.data.path, "scripts/check.sh");

  const managedFile = path.join(slaHome, "default", "skills", "deploy", "scripts", "check.sh");
  assert.equal(await fs.readFile(managedFile, "utf8"), "#!/bin/sh\necho ok\n");

  const removed = run(["skill", "remove-file", "deploy", "--path", "scripts/check.sh", "--yes"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(removed.status, 0);
  await assert.rejects(fs.access(managedFile));

  const usage = JSON.parse(
    await fs.readFile(path.join(slaHome, "default", "skills", ".usage.json"), "utf8"),
  );
  assert.equal(usage.skills.deploy.editCount, 3);
  assert.equal(usage.skills.deploy.viewCount, 0);
  assert.ok(usage.skills.deploy.lastEditedAt);
});

test("rejects invalid skill frontmatter and unsafe managed paths", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["skill", "create", "deploy"], { env: { SLA_HOME: slaHome } });

  const invalidSkillPath = path.join(slaHome, "invalid-skill.md");
  await fs.writeFile(invalidSkillPath, "# Deploy\n\nMissing frontmatter.\n", "utf8");

  const invalidFrontmatter = run(["skill", "edit", "deploy", "--file", invalidSkillPath, "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(invalidFrontmatter.status, 2);
  assert.equal(JSON.parse(invalidFrontmatter.stdout).error.code, "INVALID_SKILL_FRONTMATTER");

  const unsafeWrite = run(
    ["skill", "write-file", "deploy", "--subdir", "scripts", "--path", "../check.sh", "--stdin", "--json"],
    {
      env: { SLA_HOME: slaHome },
      input: "echo bad\n",
    },
  );
  assert.equal(unsafeWrite.status, 2);
  assert.equal(JSON.parse(unsafeWrite.stdout).error.code, "INVALID_MANAGED_PATH");

  const unsafeRemove = run(["skill", "remove-file", "deploy", "--path", "SKILL.md", "--yes", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(unsafeRemove.status, 2);
  assert.equal(JSON.parse(unsafeRemove.stdout).error.code, "INVALID_SKILL_SUBDIR");
});

test("reports global stats across profiles", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });
  run(["memory", "add", "--target", "memory", "--entry", "Default memory"], { env: { SLA_HOME: slaHome } });
  run(["memory", "add", "research", "--target", "user", "--entry", "Research preference"], {
    env: { SLA_HOME: slaHome },
  });
  run(["skill", "create", "deploy"], { env: { SLA_HOME: slaHome } });
  run(["skill", "create", "investigate", "research"], { env: { SLA_HOME: slaHome } });
  run(["skill", "view", "investigate", "research"], { env: { SLA_HOME: slaHome } });

  const result = run(["stats", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.profileCount, 2);
  assert.equal(parsed.data.defaultProfile, "default");
  assert.equal(parsed.data.totalMemories, 2);
  assert.equal(parsed.data.totalSkills, 2);
  assert.equal(parsed.data.latestActivity.profile, "research");
  assert.equal(parsed.data.latestActivity.kind, "skill");
  assert.equal(parsed.data.latestActivity.skill, "investigate");
  assert.equal(parsed.data.latestActivity.label, "skill:investigate");
  assert.ok(parsed.data.latestActivity.at);
});

test("reports per-profile stats with memory and skill activity", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });
  run(["memory", "add", "research", "--target", "memory", "--entry", "Research database"], {
    env: { SLA_HOME: slaHome },
  });
  run(["memory", "add", "research", "--target", "user", "--entry", "Prefers exact outputs"], {
    env: { SLA_HOME: slaHome },
  });
  run(["skill", "create", "deploy", "research"], { env: { SLA_HOME: slaHome } });
  run(["skill", "view", "deploy", "research"], { env: { SLA_HOME: slaHome } });

  const result = run(["stats", "profile", "research", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.profile, "research");
  assert.equal(parsed.data.memories.memory.entryCount, 1);
  assert.equal(parsed.data.memories.user.entryCount, 1);
  assert.equal(parsed.data.memories.totalEntries, 2);
  assert.equal(parsed.data.memories.lastModified.target, "user");
  assert.equal(parsed.data.memories.lastModified.label, "memory:user");
  assert.equal(parsed.data.skills.count, 1);
  assert.equal(parsed.data.skills.lastModified.skill, "deploy");
  assert.equal(parsed.data.skills.lastModified.kind, "skill");
  assert.equal(parsed.data.lastActivity.skill, "deploy");
  assert.equal(parsed.data.lastWhat, "skill:deploy");
  assert.equal(parsed.data.telemetrySchemaVersion, 1);
  assert.ok(parsed.data.soul.modifiedAt);
});

test("installs codex host wrappers and tracks installation metadata", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));

  const result = run(["host", "install", "codex", "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.host, "codex");
  assert.equal(parsed.data.installPath, path.join(codexHome, "skills"));
  assert.deepEqual(parsed.data.installedSkills, ["/use-profile", "/create-profile", "/update-profile"]);
  assert.equal(parsed.data.createdFiles.length, 6);
  assert.deepEqual(parsed.data.updatedFiles, []);
  assert.deepEqual(parsed.data.unchangedFiles, []);
  assert.ok(parsed.data.installedAt);

  const useProfileSkill = await fs.readFile(
    path.join(codexHome, "skills", "sla-use-profile", "SKILL.md"),
    "utf8",
  );
  assert.match(useProfileSkill, /sla profile dir <name>/);
  assert.match(useProfileSkill, /Do not guess profile names/);

  const useProfileAgent = await fs.readFile(
    path.join(codexHome, "skills", "sla-use-profile", "agents", "openai.yaml"),
    "utf8",
  );
  assert.match(useProfileAgent, /display_name: "\/use-profile"/);

  const config = JSON.parse(await fs.readFile(path.join(slaHome, "config.json"), "utf8"));
  assert.equal(config.hosts.codex.installed, true);
  assert.equal(config.hosts.codex.installPath, path.join(codexHome, "skills"));
  assert.deepEqual(config.hosts.codex.installedSkills, [
    "/use-profile",
    "/create-profile",
    "/update-profile",
  ]);
  assert.ok(config.hosts.codex.installedAt);
});

test("rerunning codex host install is idempotent and host list reports status", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));

  const first = run(["host", "install", "codex", "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(first.status, 0);

  const second = run(["host", "install", "codex", "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(second.status, 0);

  const secondParsed = JSON.parse(second.stdout);
  assert.equal(secondParsed.ok, true);
  assert.deepEqual(secondParsed.data.createdFiles, []);
  assert.deepEqual(secondParsed.data.updatedFiles, []);
  assert.equal(secondParsed.data.unchangedFiles.length, 6);

  const listed = run(["host", "list", "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(listed.status, 0);

  const listedParsed = JSON.parse(listed.stdout);
  assert.deepEqual(listedParsed, {
    ok: true,
    data: {
      hosts: [
        {
          host: "codex",
          available: true,
          installed: true,
          installPath: path.join(codexHome, "skills"),
          installedSkills: ["/use-profile", "/create-profile", "/update-profile"],
          installedAt: listedParsed.data.hosts[0].installedAt,
        },
      ],
    },
  });
  assert.ok(listedParsed.data.hosts[0].installedAt);
});

test("npm pack dry run includes only publish-safe runtime files", () => {
  const result = runExternal("npm", ["pack", "--json", "--dry-run"]);

  assert.equal(result.status, 0, result.stderr);
  const [packResult] = JSON.parse(result.stdout);
  const packedFiles = packResult.files.map((entry) => entry.path).sort();

  assert.deepEqual(packedFiles, [
    "LICENSE",
    "README.md",
    "bin/sla.js",
    "package.json",
    "src/cli.js",
    "src/commands/help.js",
    "src/commands/host.js",
    "src/commands/install.js",
    "src/commands/memory.js",
    "src/commands/profile.js",
    "src/commands/root.js",
    "src/commands/skill.js",
    "src/commands/soul.js",
    "src/commands/stats.js",
    "src/lib/bootstrap.js",
    "src/lib/config.js",
    "src/lib/constants.js",
    "src/lib/errors.js",
    "src/lib/examples.js",
    "src/lib/filesystem.js",
    "src/lib/hosts.js",
    "src/lib/memory.js",
    "src/lib/not-implemented.js",
    "src/lib/output.js",
    "src/lib/paths.js",
    "src/lib/profiles.js",
    "src/lib/skills.js",
    "src/lib/soul.js",
    "src/lib/stats.js",
    "src/lib/usage.js",
    "src/lib/validation.js",
  ]);
});

test("packed tarball installs cleanly and exposes the sla binary", async () => {
  const packDestination = await fs.mkdtemp(path.join(os.tmpdir(), "sla-pack-"));
  const installDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "sla-install-"));

  const packed = runExternal("npm", ["pack", "--json", "--pack-destination", packDestination]);
  assert.equal(packed.status, 0, packed.stderr);

  const [packResult] = JSON.parse(packed.stdout);
  const tarballPath = path.join(packDestination, packResult.filename);

  const initialized = runExternal("npm", ["init", "-y"], { cwd: installDirectory });
  assert.equal(initialized.status, 0, initialized.stderr);

  const installed = runExternal("npm", ["install", tarballPath], { cwd: installDirectory });
  assert.equal(installed.status, 0, installed.stderr);

  const slaBinary = path.join(
    installDirectory,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "sla.cmd" : "sla",
  );
  const help = runCommand(slaBinary, ["help"], { cwd: installDirectory });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Profile-scoped memory and skills CLI for agents\./);
});

async function createTempSlaHome() {
  return fs.mkdtemp(path.join(os.tmpdir(), "sla-test-"));
}

async function createInstalledSlaHome() {
  const slaHome = await createTempSlaHome();
  const result = run(["install"], { env: { SLA_HOME: slaHome } });
  assert.equal(result.status, 0);
  return slaHome;
}

async function assertPathExists(targetPath) {
  await fs.access(targetPath);
}
