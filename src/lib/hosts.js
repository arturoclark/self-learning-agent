const fs = require("node:fs/promises");
const { saveConfig } = require("./config");
const { SLAError } = require("./errors");
const { ensureDirectory, pathExists, writeFileAtomic } = require("./filesystem");
const { requireConfig } = require("./profiles");
const { getCodexAgentPath, getCodexSkillPath, getCodexSkillsPath } = require("./paths");

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
10. If the task reveals durable facts or preferences, persist them with \`sla memory add|replace|remove\`.
11. If the task reveals a reusable workflow, persist it with \`sla skill create|edit|delete\`.
12. If you cannot tell whether the new information belongs in memory, user memory, or a skill, run \`sla profile classify <name> --stdin\` or \`--file\` before writing anything.
13. State that the session is now operating against that profile and keep subsequent \`sla\` commands scoped to it until the user changes profiles again.

## Operating Rules

- Prefer \`sla\` commands over direct filesystem edits for anything under \`~/.sla\`.
- Facts and stable preferences belong in \`sla memory\`; reusable workflows and procedures belong in \`sla skill\`.
- Persist only durable knowledge; do not store turn-local or obviously temporary notes unless the user explicitly asks.
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

async function installHost(hostName) {
  const config = await requireConfig();
  const adapter = getHostAdapter(hostName);
  const installation = await adapter.install();
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
    installedSkills: installation.installedSkills,
    createdFiles: installation.createdFiles,
    updatedFiles: installation.updatedFiles,
    unchangedFiles: installation.unchangedFiles,
    installedAt: nextConfig.hosts[hostName].installedAt,
  };
}

async function hostInstallRequiresOverwrite(hostName) {
  const adapter = getHostAdapter(hostName);
  if (typeof adapter.requiresOverwrite !== "function") {
    return {
      requiresOverwrite: false,
      existingFiles: [],
    };
  }

  return adapter.requiresOverwrite();
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
    async requiresOverwrite() {
      const existingFiles = [];

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

      return {
        requiresOverwrite: existingFiles.length > 0,
        existingFiles,
      };
    },
    async install() {
      const installPath = getCodexSkillsPath();
      const createdFiles = [];
      const updatedFiles = [];
      const unchangedFiles = [];

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

      return {
        installPath,
        installedSkills: CODEX_SKILLS.map((skill) => skill.command),
        createdFiles,
        updatedFiles,
        unchangedFiles,
        configEntry: {
          available: true,
          installed: true,
          installPath,
          installedAt: new Date().toISOString(),
          installedSkills: CODEX_SKILLS.map((skill) => skill.command),
        },
      };
    },
    async getStatus(config) {
      const hostConfig = config.hosts?.codex || {};
      const installPath = hostConfig.installPath || getCodexSkillsPath();
      const installedSkills = hostConfig.installedSkills || CODEX_SKILLS.map((skill) => skill.command);
      const installed = await areCodexSkillsInstalled();

      return {
        host: "codex",
        available: true,
        installed,
        installPath,
        installedSkills,
        installedAt: installed ? hostConfig.installedAt || null : null,
      };
    },
  };
}

async function areCodexSkillsInstalled() {
  for (const skill of CODEX_SKILLS) {
    const skillPath = getCodexSkillPath(skill.key);
    if (!(await pathExists(`${skillPath}/SKILL.md`))) {
      return false;
    }

    if (!(await pathExists(getCodexAgentPath(skill.key)))) {
      return false;
    }
  }

  return true;
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
