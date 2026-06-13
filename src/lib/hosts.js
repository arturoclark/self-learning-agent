const fs = require("node:fs/promises");
const path = require("node:path");
const { saveConfig } = require("./config");
const { SLAError } = require("./errors");
const { ensureDirectory, pathExists, writeFileAtomic } = require("./filesystem");
const { requireConfig } = require("./profiles");
const {
  getCodexAgentPath,
  getCodexHookScriptPath,
  getCodexHooksConfigPath,
  getCodexHooksPath,
  getCodexSkillPath,
  getCodexSkillsPath,
} = require("./paths");

const CODEX_SKILLS = [
  {
    key: "sla-use-profile",
    command: "/use-profile",
    shortDescription: "Work inside a chosen sla profile",
    defaultPrompt: "Use $sla-use-profile to set and use the requested sla profile: <task>.",
    skillMarkdown: `---
name: sla-use-profile
description: Use \`sla\` commands to switch the session to a named profile and keep later work scoped to it.
---

# Use Profile

## Overview

Use this skill when the user asks to work inside a specific \`sla\` profile. The goal is to load the profile context first, then use the right CLI command for the kind of information you need.

## Workflow

1. Determine the exact profile name from the user request. If no exact name is available, say: \`I don't know, help me get more context\`.
2. Run \`sla profile dir <name>\` to verify the profile exists and capture its absolute path.
3. Always run \`sla profile context <name> --json\` for the provided profile. This is required and not optional.
4. Treat that returned snapshot as the active profile context for the session.
5. Use \`sla soul view <name>\` when you need the profile's purpose, constraints, or top-level identity as written in \`SOUL.md\`.
6. Use \`sla memory list <name>\` or \`sla memory view <name> --target memory|user\` when you need durable facts, preferences, or user-specific context. Use \`list\` for the full current memory contents and \`view\` for one target.
7. Use \`sla skill list <name>\` when you need the skill catalog. It is the compact index only.
8. Use \`sla skill view <skill> <name>\` only when one of the listed skills is relevant and you need the full skill body before acting. Loading full skills depends on the task, but the profile context does not.
9. Use \`sla stats profile <name>\` when you need activity or usage context, not for the core profile content itself.
10. Treat persistence review as mandatory before you finish the task or end the turn. Explicitly ask: did this session produce a durable fact, a reusable skill-worthy capability, or deep supporting reference material?
11. Persist durable facts, constraints, environment notes, and stable preferences with \`sla memory add|replace|remove\`.
12. Persist reusable repo/domain/task capabilities with \`sla skill create|edit|delete\`. Store a skill when the session produced guidance that should help an agent succeed again in the same codebase, system, or recurring task family, not just when you discovered a strict step-by-step procedure.
13. A skill is the right target when the learned material would be useful across future sessions as an operational guide, such as workflows, checklists, decision trees, debugging playbooks, deploy and release flows, repo maps, file-entrypoint maps, environment and branch rules, API integration patterns, auth and routing rules, or other recurring implementation guidance.
14. Do not flatten that kind of reusable operational knowledge into memory entries. If it is richer than a short fact and should guide future work, it belongs in a skill even when it mixes procedure with concise reference context.
15. Keep \`SKILL.md\` action-oriented and procedural. It should say when to use the skill, how to proceed, the important commands/files, the key decision points, and any concise operational context needed to execute correctly.
16. When the session produces deeper material that is too large or explanatory for memory and not itself the main workflow, create or update reference docs under that skill with \`sla skill create-reference <skill> <name> --path <file>.md --title "<Title>"\` or \`sla skill write-file <skill> <name> --subdir references --path <file>.md\`.
17. Use skill references for architecture maps, environment inventories, branch and deploy matrices, bug forensics, incident writeups, API shapes, file maps, implementation plans, and other rich repo context that supports a skill.
18. If you cannot tell whether new information belongs in memory, user memory, or a skill, run \`sla profile classify <name> --stdin\` or \`--file\` before writing anything. If it is clearly reference material that belongs under an existing skill, create or update a reference doc instead of flattening it into memory.
19. If later work in the same session spans multiple explicit \`/use-profile\` commands, persist durable memories, skills, and references against the correct profile for each piece of work instead of collapsing everything into one default profile.
20. Only store durable knowledge learned from the session. After any needed persistence work, finish the turn.
21. State that the session is now operating against that profile and keep subsequent \`sla\` commands scoped to it until the user changes profiles again.

## Operating Rules

- Prefer \`sla\` commands over direct filesystem edits for anything under \`~/.sla\`.
- Facts and stable preferences belong in \`sla memory\`.
- Reusable operational knowledge belongs in \`sla skill\`: anything an agent should reuse later as a guide for working in the same repo, domain, system, or recurring task family.
- Use skills for capabilities such as implementation workflows, debugging approaches, deploy/release runbooks, repo maps, environment matrices, integration patterns, file/entrypoint guides, and decision rules.
- Keep rich supporting context in \`references/*.md\` inside the relevant skill directory when it is too detailed for \`SKILL.md\` or is supporting analysis rather than the main workflow.
- Persist only durable knowledge; do not store turn-local or obviously temporary notes unless the user explicitly asks.
- Before ending a profiled task, do one final persistence review for durable facts, reusable skill-worthy guidance, and supporting reference material learned during the session.
- Use \`sla profile context\` as the required starting point for a profile session, then load more detail only when the current task needs it.
- Do not treat the compact skill index as full skill content.
- Do not guess profile names.
- If the profile lookup fails or the user request is ambiguous, say: \`I don't know, help me get more context\`.
`,
  },
  {
    key: "sla-create-profile",
    command: "/create-profile",
    shortDescription: "Create a new sla profile through the CLI",
    defaultPrompt: "Use $sla-create-profile to create an sla profile for this request: <task>.",
    skillMarkdown: `---
name: sla-create-profile
description: Create a new \`sla\` profile and capture explicit user intent with CLI commands.
---

# Create Profile

## Overview

Use this skill when the user wants a new \`sla\` profile.

## Workflow

1. Identify the exact profile name and the user-provided purpose for the profile. If either is missing, say: \`I don't know, help me get more context\`.
2. Run \`sla profile create <name>\` to scaffold the profile.
3. Run \`sla soul edit <name> --stdin\` or \`sla soul edit <name> --file <path>\` to write the user-approved \`SOUL.md\` content.
4. Add durable facts with \`sla memory add <name> --target memory|user --entry "..."\` only when the user has explicitly provided them.
5. If the content might be a reusable workflow instead of a fact, run \`sla profile classify <name> --stdin\` or \`--file\` before deciding whether to write memory or create a skill.
6. Confirm the created profile name and path by using CLI output rather than describing the filesystem from memory.

## Operating Rules

- Do not synthesize profile intent beyond what the user explicitly states.
- Store facts and stable preferences in memory; store reusable procedures as skills.
- Prefer \`sla\` commands over direct filesystem edits for \`~/.sla\`.
- If the required name or purpose is missing, say: \`I don't know, help me get more context\`.
`,
  },
  {
    key: "sla-update-profile",
    command: "/update-profile",
    shortDescription: "Update an sla profile through the CLI",
    defaultPrompt: "Use $sla-update-profile to update an sla profile for this request: <task>.",
    skillMarkdown: `---
name: sla-update-profile
description: Update an existing \`sla\` profile by using CLI commands for soul, memory, and skill maintenance.
---

# Update Profile

## Overview

Use this skill when the user wants to change a profile's \`SOUL.md\`, memories, or installed skills.

## Workflow

1. Resolve the target profile exactly. If it is omitted, use \`sla profile get-default\`; if that still leaves the task ambiguous, say: \`I don't know, help me get more context\`.
2. Inspect current state with \`sla profile context <name> --json\`, \`sla skill view <skill> <name>\`, or \`sla stats profile <name>\` before changing anything material.
3. If the requested change could be either a fact or a reusable workflow, run \`sla profile classify <name> --stdin\` or \`--file\` before writing anything.
4. Apply updates with the relevant \`sla\` commands such as \`sla soul edit\`, \`sla memory add|replace|remove\`, \`sla skill create|edit|delete\`, or \`sla skill write-file|remove-file\`.
5. Report the concrete CLI-backed changes and keep future work scoped to that same profile unless the user changes targets.

## Operating Rules

- Do not edit \`~/.sla\` directly when an \`sla\` command exists.
- Store facts and stable preferences in memory; store reusable procedures as skills.
- Do not guess missing profile names or missing content.
- If the target profile or requested update is unclear, say: \`I don't know, help me get more context\`.
`,
  },
];

const CODEX_STOP_HOOK_FILE = "sla-stop-hook.js";
const CODEX_STOP_HOOK_STATUS_MESSAGE = "Checking whether SLA memories or skills should be persisted";

function getSupportedHosts() {
  return [createCodexAdapter()];
}

function getHostAdapter(hostName) {
  const adapter = getSupportedHosts().find((entry) => entry.name === hostName);
  if (adapter) {
    return adapter;
  }

  throw new SLAError(`Host '${hostName}' is not supported.`, {
    code: "HOST_NOT_SUPPORTED",
    exitCode: 2,
    details: {
      host: hostName,
      supportedHosts: getSupportedHosts().map((entry) => entry.name),
    },
  });
}

async function installHost(hostName, options = {}) {
  const config = await requireConfig();
  const adapter = getHostAdapter(hostName);
  const installation = await adapter.install(options);
  const existing = config.hosts?.[hostName] || {};
  const installedAt = existing.installedAt || installation.configEntry.installedAt;

  const nextConfig = await saveConfig({
    ...config,
    hosts: {
      ...config.hosts,
      [hostName]: {
        ...existing,
        ...installation.configEntry,
        installedAt,
      },
    },
  });

  return {
    host: hostName,
    installPath: installation.installPath,
    hooksConfigPath: installation.hooksConfigPath,
    stopHookPath: installation.stopHookPath,
    hookScope: installation.hookScope,
    repositoryPath: installation.repositoryPath,
    installedSkills: installation.installedSkills,
    createdFiles: installation.createdFiles,
    updatedFiles: installation.updatedFiles,
    unchangedFiles: installation.unchangedFiles,
    installedAt: nextConfig.hosts[hostName].installedAt,
  };
}

async function hostInstallRequiresOverwrite(hostName, options = {}) {
  const adapter = getHostAdapter(hostName);
  if (typeof adapter.requiresOverwrite !== "function") {
    return {
      requiresOverwrite: false,
      existingFiles: [],
    };
  }

  return adapter.requiresOverwrite(options);
}

async function listHosts() {
  const config = await requireConfig();
  const hosts = [];

  for (const adapter of getSupportedHosts()) {
    hosts.push(await adapter.getStatus(config));
  }

  return { hosts };
}

function createCodexAdapter() {
  return {
    name: "codex",
    async requiresOverwrite(options = {}) {
      const existingFiles = [];
      const hookTarget = await resolveCodexHookTarget(options);

      for (const skill of CODEX_SKILLS) {
        const skillPath = getCodexSkillPath(skill.key);
        const markdownPath = `${skillPath}/SKILL.md`;
        const agentPath = getCodexAgentPath(skill.key);

        if (await pathExists(markdownPath)) {
          existingFiles.push(markdownPath);
        }

        if (await pathExists(agentPath)) {
          existingFiles.push(agentPath);
        }
      }

      if (await pathExists(hookTarget.stopHookPath)) {
        existingFiles.push(hookTarget.stopHookPath);
      }

      return {
        requiresOverwrite: existingFiles.length > 0,
        existingFiles,
      };
    },
    async install(options = {}) {
      const installPath = getCodexSkillsPath();
      const createdFiles = [];
      const updatedFiles = [];
      const unchangedFiles = [];
      const hookTarget = await resolveCodexHookTarget(options);

      await ensureDirectory(installPath);

      for (const skill of CODEX_SKILLS) {
        const skillPath = getCodexSkillPath(skill.key);
        const markdownPath = `${skillPath}/SKILL.md`;
        const agentPath = getCodexAgentPath(skill.key);

        await ensureDirectory(skillPath);
        await ensureDirectory(`${skillPath}/agents`);

        await writeTrackedFile(markdownPath, skill.skillMarkdown, {
          createdFiles,
          updatedFiles,
          unchangedFiles,
        });
        await writeTrackedFile(agentPath, renderOpenAIYaml(skill), {
          createdFiles,
          updatedFiles,
          unchangedFiles,
        });
      }

      await ensureDirectory(hookTarget.hooksPath);
      await writeTrackedFile(hookTarget.stopHookPath, renderCodexStopHookScript(), {
        createdFiles,
        updatedFiles,
        unchangedFiles,
      });

      const hooksWriteResult = await writeCodexHooksConfig(hookTarget);
      createdFiles.push(...hooksWriteResult.createdFiles);
      updatedFiles.push(...hooksWriteResult.updatedFiles);
      unchangedFiles.push(...hooksWriteResult.unchangedFiles);

      if (options.gitignore && hookTarget.scope === "repository" && hookTarget.repositoryPath) {
        const gitignoreResult = await ensureRepositoryCodexGitignore(hookTarget.repositoryPath);
        createdFiles.push(...gitignoreResult.createdFiles);
        updatedFiles.push(...gitignoreResult.updatedFiles);
        unchangedFiles.push(...gitignoreResult.unchangedFiles);
      }

      return {
        installPath,
        hooksConfigPath: hookTarget.hooksConfigPath,
        stopHookPath: hookTarget.stopHookPath,
        hookScope: hookTarget.scope,
        repositoryPath: hookTarget.repositoryPath,
        installedSkills: CODEX_SKILLS.map((skill) => skill.command),
        createdFiles,
        updatedFiles,
        unchangedFiles,
        configEntry: {
          available: true,
          installed: true,
          installPath,
          hooksConfigPath: hookTarget.hooksConfigPath,
          stopHookPath: hookTarget.stopHookPath,
          hookScope: hookTarget.scope,
          repositoryPath: hookTarget.repositoryPath,
          installedAt: new Date().toISOString(),
          installedSkills: CODEX_SKILLS.map((skill) => skill.command),
        },
      };
    },
    async getStatus(config) {
      const hostConfig = config.hosts?.codex || {};
      const installPath = hostConfig.installPath || getCodexSkillsPath();
      const installedSkills = hostConfig.installedSkills || CODEX_SKILLS.map((skill) => skill.command);
      const hookTarget = await resolveConfiguredCodexHookTarget(hostConfig);
      const installed = await isCodexHostInstalled(hookTarget);

      return {
        host: "codex",
        available: true,
        installed,
        installPath,
        hooksConfigPath: hookTarget.hooksConfigPath,
        stopHookPath: hookTarget.stopHookPath,
        hookScope: hookTarget.scope,
        repositoryPath: hookTarget.repositoryPath,
        installedSkills,
        installedAt: installed ? hostConfig.installedAt || null : null,
      };
    },
  };
}

async function isCodexHostInstalled(hookTarget) {
  for (const skill of CODEX_SKILLS) {
    const skillPath = getCodexSkillPath(skill.key);
    if (!(await pathExists(`${skillPath}/SKILL.md`))) {
      return false;
    }

    if (!(await pathExists(getCodexAgentPath(skill.key)))) {
      return false;
    }
  }

  if (!(await pathExists(hookTarget.stopHookPath))) {
    return false;
  }

  if (!(await pathExists(hookTarget.hooksConfigPath))) {
    return false;
  }

  const config = await readJsonIfExists(hookTarget.hooksConfigPath);
  return hasManagedCodexStopHook(config, hookTarget);
}

function renderOpenAIYaml(skill) {
  return [
    "interface:",
    `  display_name: "${skill.command}"`,
    `  short_description: "${skill.shortDescription}"`,
    `  default_prompt: "${skill.defaultPrompt}"`,
    "",
  ].join("\n");
}

function renderCodexStopHookScript() {
  return [
    "#!/usr/bin/env node",
    "",
    'const fs = require("node:fs");',
    "",
    "const payload = JSON.parse(fs.readFileSync(0, \"utf8\"));",
    "",
    "if (payload.stop_hook_active) {",
    "  process.exit(0);",
    "}",
    "",
    "const profiles = collectProfilesFromTranscript(payload.transcript_path);",
    "const profileInstruction = profiles.length > 0",
    "  ? [",
    '      `Use the SLA profiles established in this session: ${profiles.join(\", \")}.`,',
    '      \"Persist durable memories and skills against the correct listed profile. If work spans multiple listed profiles, update each relevant one instead of collapsing everything into the default profile.\",',
    "    ].join(\"\\n\")",
    "  : \"If no explicit profile was established, use `sla profile get-default` and only continue if that is actually the right target; otherwise say `I don't know, help me get more context`.\";",
    "",
    "const response = {",
    '  decision: "block",',
    '  reason: [',
    '    "SLA -> Before stopping, review this session for durable SLA profile updates.",',
    '    "Use `sla` CLI commands, not direct edits under `~/.sla`.",',
    "    profileInstruction,",
    '    "Do a mandatory persistence review: identify any durable facts, reusable skill-worthy capabilities, or rich supporting reference material learned during the session.",',
    '    "Persist durable facts, constraints, environment notes, and stable preferences with `sla memory add`, `sla memory replace`, or `sla memory remove`.",',
    '    "Persist reusable repo/domain/task capabilities by creating or updating a skill with `sla skill` commands. Store a skill when the session produced guidance that should help an agent succeed again in the same codebase, system, or recurring task family, not just when you discovered a strict step-by-step procedure.",',
    '    "A skill is the right target for reusable operational guidance such as workflows, checklists, debugging playbooks, deploy/release runbooks, repo maps, environment rules, integration patterns, auth/routing rules, file-entrypoint guides, and similar recurring implementation knowledge.",',
    '    "Do not flatten that kind of reusable guidance into memory. Keep `SKILL.md` action-oriented: when to use the skill, how to proceed, the important commands/files, the decision points, and any concise operational context needed to execute correctly.",',
    '    "Put deep supporting context in `references/*.md` under the relevant skill directory.",',
    '    "Create or update reference docs for architecture notes, environment matrices, bug forensics, API shapes, file maps, and implementation plans with `sla skill create-reference <skill> <name> --path <file>.md --title \\"<Title>\\"` or `sla skill write-file <skill> <name> --subdir references --path <file>.md`.",',
    '    "If the storage target is ambiguous, run `sla profile classify <name> --stdin` or `--file` first. If the material clearly supports an existing skill without being a procedure itself, store it as a reference, not a memory entry.",',
    '    "Only store durable knowledge learned from the session. After any needed persistence work, finish the turn."',
    '  ].join("\\n")',
    "};",
    "",
    "process.stdout.write(`${JSON.stringify(response)}\\n`);",
    "",
    "function collectProfilesFromTranscript(transcriptPath) {",
    "  if (!transcriptPath) {",
    "    return [];",
    "  }",
    "",
    "  try {",
    "    const raw = fs.readFileSync(transcriptPath, \"utf8\");",
    "    const seen = new Set();",
    "    const profiles = [];",
    "",
    "    for (const line of raw.split(/\\r?\\n/)) {",
    "      if (!line.trim()) {",
    "        continue;",
    "      }",
    "",
    "      const entry = JSON.parse(line);",
    "      for (const text of extractTranscriptText(entry)) {",
    "        for (const profile of extractProfilesFromText(text)) {",
    "          if (seen.has(profile)) {",
    "            continue;",
    "          }",
    "",
    "          seen.add(profile);",
    "          profiles.push(profile);",
    "        }",
    "      }",
    "    }",
    "",
    "    return profiles;",
    "  } catch (_error) {",
    "    return [];",
    "  }",
    "}",
    "",
    "function extractTranscriptText(entry) {",
    "  const texts = [];",
    "  const payload = entry && typeof entry === \"object\" ? entry.payload : null;",
    "",
    "  if (!payload || typeof payload !== \"object\") {",
    "    return texts;",
    "  }",
    "",
    "  if (payload.type === \"message\" && payload.role === \"user\" && Array.isArray(payload.content)) {",
    "    for (const item of payload.content) {",
    "      if (item?.type === \"input_text\" && typeof item.text === \"string\") {",
    "        texts.push(item.text);",
    "      }",
    "    }",
    "  }",
    "",
    "  if (entry.type === \"event_msg\" && payload.type === \"user_message\" && typeof payload.message === \"string\") {",
    "    texts.push(payload.message);",
    "  }",
    "",
    "  return texts;",
    "}",
    "",
    "function extractProfilesFromText(text) {",
    "  const profiles = [];",
    "  for (const rawLine of text.split(/\\r?\\n/)) {",
    "    const line = rawLine.trim();",
    "    const match = line.match(/^(?:[-*]\\s+)?\\/use-profile\\s+([A-Za-z0-9][A-Za-z0-9._-]*)\\b/);",
    "    if (!match) {",
    "      continue;",
    "    }",
    "",
    "    profiles.push(match[1]);",
    "  }",
    "",
    "  return profiles;",
    "}",
    "",
  ].join("\n");
}

async function writeCodexHooksConfig(hookTarget) {
  const configPath = hookTarget.hooksConfigPath;
  const existing = (await readJsonIfExists(configPath)) || {};
  const nextConfig = mergeCodexStopHook(existing, hookTarget);
  const serialized = `${JSON.stringify(nextConfig, null, 2)}\n`;

  if (!(await pathExists(configPath))) {
    await writeFileAtomic(configPath, serialized);
    return {
      createdFiles: [configPath],
      updatedFiles: [],
      unchangedFiles: [],
    };
  }

  const current = await fs.readFile(configPath, "utf8");
  if (current === serialized) {
    return {
      createdFiles: [],
      updatedFiles: [],
      unchangedFiles: [configPath],
    };
  }

  await writeFileAtomic(configPath, serialized);
  return {
    createdFiles: [],
    updatedFiles: [configPath],
    unchangedFiles: [],
  };
}

async function ensureRepositoryCodexGitignore(repositoryPath) {
  const gitignorePath = `${repositoryPath}/.gitignore`;
  if (!(await pathExists(gitignorePath))) {
    return {
      createdFiles: [],
      updatedFiles: [],
      unchangedFiles: [],
    };
  }

  const current = await fs.readFile(gitignorePath, "utf8");
  const lines = current.split(/\r?\n/);
  if (lines.some((line) => line.trim() === ".codex/" || line.trim() === ".codex")) {
    return {
      createdFiles: [],
      updatedFiles: [],
      unchangedFiles: [gitignorePath],
    };
  }

  const next = appendGitignoreEntry(current, ".codex/");
  await writeFileAtomic(gitignorePath, next);
  return {
    createdFiles: [],
    updatedFiles: [gitignorePath],
    unchangedFiles: [],
  };
}

function appendGitignoreEntry(current, entry) {
  if (current.length === 0) {
    return `${entry}\n`;
  }

  const normalized = current.endsWith("\n") ? current : `${current}\n`;
  return `${normalized}${entry}\n`;
}

function mergeCodexStopHook(config, hookTarget) {
  const hooks = isPlainObject(config.hooks) ? { ...config.hooks } : {};
  const stopEntries = Array.isArray(hooks.Stop) ? hooks.Stop.map(cloneHookEntry) : [];
  const managedCommand = renderCodexStopHookCommand(hookTarget);
  let foundGroup = false;

  for (let index = 0; index < stopEntries.length; index += 1) {
    const entry = stopEntries[index];
    const innerHooks = Array.isArray(entry.hooks) ? entry.hooks : [];
    const hookIndex = innerHooks.findIndex((hook) => isManagedCodexStopHook(hook));
    if (hookIndex === -1) {
      continue;
    }

    foundGroup = true;
    const nextInnerHooks = [...innerHooks];
    nextInnerHooks[hookIndex] = {
      type: "command",
      command: managedCommand,
      timeout: 30,
      statusMessage: CODEX_STOP_HOOK_STATUS_MESSAGE,
    };
    stopEntries[index] = { ...entry, hooks: nextInnerHooks };
  }

  if (!foundGroup) {
    stopEntries.push({
      hooks: [
        {
          type: "command",
          command: managedCommand,
          timeout: 30,
          statusMessage: CODEX_STOP_HOOK_STATUS_MESSAGE,
        },
      ],
    });
  }

  hooks.Stop = stopEntries;
  return {
    ...config,
    hooks,
  };
}

function hasManagedCodexStopHook(config, hookTarget) {
  const stopEntries = Array.isArray(config?.hooks?.Stop) ? config.hooks.Stop : [];
  const expectedCommand = renderCodexStopHookCommand(hookTarget);

  return stopEntries.some((entry) =>
    Array.isArray(entry?.hooks) &&
    entry.hooks.some(
      (hook) =>
        hook?.type === "command" &&
        hook?.command === expectedCommand &&
        hook?.statusMessage === CODEX_STOP_HOOK_STATUS_MESSAGE,
    ),
  );
}

function renderCodexStopHookCommand(hookTarget) {
  if (hookTarget.scope === "repository") {
    return `node .codex/hooks/${CODEX_STOP_HOOK_FILE}`;
  }

  return `node ${JSON.stringify(hookTarget.stopHookPath)}`;
}

function isManagedCodexStopHook(hook) {
  return (
    hook?.type === "command" &&
    typeof hook.command === "string" &&
    hook.command.includes(CODEX_STOP_HOOK_FILE)
  );
}

function cloneHookEntry(entry) {
  if (!isPlainObject(entry)) {
    return entry;
  }

  return {
    ...entry,
    hooks: Array.isArray(entry.hooks) ? entry.hooks.map((hook) => (isPlainObject(hook) ? { ...hook } : hook)) : entry.hooks,
  };
}

async function readJsonIfExists(targetPath) {
  if (!(await pathExists(targetPath))) {
    return null;
  }

  try {
    return JSON.parse(await fs.readFile(targetPath, "utf8"));
  } catch (error) {
    throw new SLAError("The Codex hooks config is invalid and could not be read.", {
      code: "INVALID_CODEX_HOOKS_CONFIG",
      exitCode: 1,
      details: {
        configPath: targetPath,
        reason: error.message,
      },
    });
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function resolveCodexHookTarget(options = {}) {
  if (!options.repository) {
    return {
      scope: "global",
      repositoryPath: null,
      hooksPath: getCodexHooksPath(),
      hooksConfigPath: getCodexHooksConfigPath(),
      stopHookPath: getCodexHookScriptPath(CODEX_STOP_HOOK_FILE),
    };
  }

  const repositoryPath = await resolveRepositoryPath(options.repository);
  const hooksRoot = resolveCodexHooksRoot(repositoryPath);

  return {
    scope: "repository",
    repositoryPath,
    hooksPath: `${hooksRoot}/hooks`,
    hooksConfigPath: `${hooksRoot}/hooks.json`,
    stopHookPath: `${hooksRoot}/hooks/${CODEX_STOP_HOOK_FILE}`,
  };
}

async function resolveConfiguredCodexHookTarget(hostConfig) {
  if (hostConfig.hookScope === "repository" && hostConfig.repositoryPath) {
    return resolveCodexHookTarget({ repository: hostConfig.repositoryPath });
  }

  return resolveCodexHookTarget();
}

async function resolveRepositoryPath(inputPath) {
  const repositoryPath = await fs.realpath(inputPath).catch((error) => {
    if (error?.code === "ENOENT") {
      throw new SLAError("The repository path does not exist.", {
        code: "REPOSITORY_NOT_FOUND",
        exitCode: 1,
        details: {
          repositoryPath: inputPath,
        },
      });
    }

    throw error;
  });

  const stats = await fs.stat(repositoryPath);
  if (!stats.isDirectory()) {
    throw new SLAError("The repository path must be a directory.", {
      code: "REPOSITORY_NOT_DIRECTORY",
      exitCode: 1,
      details: {
        repositoryPath,
      },
    });
  }

  return repositoryPath;
}

function resolveCodexHooksRoot(repositoryPath) {
  if (path.basename(repositoryPath) === ".codex") {
    return repositoryPath;
  }

  return `${repositoryPath}/.codex`;
}

async function writeTrackedFile(targetPath, content, buckets) {
  if (!(await pathExists(targetPath))) {
    await writeFileAtomic(targetPath, content);
    buckets.createdFiles.push(targetPath);
    return;
  }

  const current = await fs.readFile(targetPath, "utf8");
  if (current === content) {
    buckets.unchangedFiles.push(targetPath);
    return;
  }

  await writeFileAtomic(targetPath, content);
  buckets.updatedFiles.push(targetPath);
}

module.exports = {
  hostInstallRequiresOverwrite,
  installHost,
  listHosts,
};
