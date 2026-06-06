const fs = require("node:fs/promises");
const { saveConfig } = require("./config");
const { SLEError } = require("./errors");
const { ensureDirectory, pathExists, writeFileAtomic } = require("./filesystem");
const { requireConfig } = require("./profiles");
const { getCodexAgentPath, getCodexSkillPath, getCodexSkillsPath } = require("./paths");

const CODEX_SKILLS = [
  {
    key: "sle-use-profile",
    command: "/use-profile",
    shortDescription: "Work inside a chosen sle profile",
    defaultPrompt: "Use $sle-use-profile to set and use the requested sle profile: <task>.",
    skillMarkdown: `---
name: sle-use-profile
description: Use \`sle\` commands to switch the session to a named profile and keep later work scoped to it.
---

# Use Profile

## Overview

Use this skill when the user asks to switch to a specific \`sle\` profile for the current task.

## Workflow

1. Determine the exact profile name from the user request. If no exact name is available, say: \`I don't know, help me get more context\`.
2. Run \`sle profile dir <name>\` to verify the profile exists and capture its absolute path.
3. Run \`sle soul view <name>\` to read the profile purpose before making changes.
4. Use \`sle memory ... <name>\`, \`sle skill ... <name>\`, \`sle soul ... <name>\`, and \`sle stats profile <name>\` for profile-scoped reads and writes.
5. State that the session is now operating against that profile and keep subsequent \`sle\` commands scoped to it until the user changes profiles again.

## Operating Rules

- Prefer \`sle\` commands over direct filesystem edits for anything under \`~/.sle\`.
- Do not guess profile names.
- If the profile lookup fails or the user request is ambiguous, say: \`I don't know, help me get more context\`.
`,
  },
  {
    key: "sle-create-profile",
    command: "/create-profile",
    shortDescription: "Create a new sle profile through the CLI",
    defaultPrompt: "Use $sle-create-profile to create an sle profile for this request: <task>.",
    skillMarkdown: `---
name: sle-create-profile
description: Create a new \`sle\` profile and capture explicit user intent with CLI commands.
---

# Create Profile

## Overview

Use this skill when the user wants a new \`sle\` profile.

## Workflow

1. Identify the exact profile name and the user-provided purpose for the profile. If either is missing, say: \`I don't know, help me get more context\`.
2. Run \`sle profile create <name>\` to scaffold the profile.
3. Run \`sle soul edit <name> --stdin\` or \`sle soul edit <name> --file <path>\` to write the user-approved \`SOUL.md\` content.
4. Add durable facts with \`sle memory add <name> --target memory|user --entry "..."\` only when the user has explicitly provided them.
5. Confirm the created profile name and path by using CLI output rather than describing the filesystem from memory.

## Operating Rules

- Do not synthesize profile intent beyond what the user explicitly states.
- Prefer \`sle\` commands over direct filesystem edits for \`~/.sle\`.
- If the required name or purpose is missing, say: \`I don't know, help me get more context\`.
`,
  },
  {
    key: "sle-update-profile",
    command: "/update-profile",
    shortDescription: "Update an sle profile through the CLI",
    defaultPrompt: "Use $sle-update-profile to update an sle profile for this request: <task>.",
    skillMarkdown: `---
name: sle-update-profile
description: Update an existing \`sle\` profile by using CLI commands for soul, memory, and skill maintenance.
---

# Update Profile

## Overview

Use this skill when the user wants to change a profile's \`SOUL.md\`, memories, or installed skills.

## Workflow

1. Resolve the target profile exactly. If it is omitted, use \`sle profile get-default\`; if that still leaves the task ambiguous, say: \`I don't know, help me get more context\`.
2. Inspect current state with \`sle soul view <name>\`, \`sle memory list <name>\`, \`sle skill list <name>\`, or \`sle stats profile <name>\` before changing anything material.
3. Apply updates with the relevant \`sle\` commands such as \`sle soul edit\`, \`sle memory add|replace|remove\`, \`sle skill create|edit|delete\`, or \`sle skill write-file|remove-file\`.
4. Report the concrete CLI-backed changes and keep future work scoped to that same profile unless the user changes targets.

## Operating Rules

- Do not edit \`~/.sle\` directly when an \`sle\` command exists.
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

  throw new SLEError(`Host '${hostName}' is not supported.`, {
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
  installHost,
  listHosts,
};
