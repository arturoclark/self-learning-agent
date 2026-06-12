const fs = require("node:fs/promises");
const path = require("node:path");
const { SLAError } = require("./errors");
const { ensureDirectory, pathExists, withFileLock, writeFileAtomic } = require("./filesystem");
const { getSkillMarkdownPath, getSkillPath, getSkillsPath } = require("./paths");
const { resolveExistingProfile } = require("./profiles");
const { loadUsage, removeSkillUsage, updateSkillUsage } = require("./usage");

const FRONTMATTER_DELIMITER = "---";
const ALLOWED_MANAGED_SUBDIRS = new Set(["references", "templates", "scripts", "assets"]);

async function listSkills(requestedName) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const skillsRoot = getSkillsPath(profileName);
  const usage = await loadUsage(profileName);
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillName = entry.name;
    const skill = await readSkill(profileName, skillName);
    skills.push({
      skill: skillName,
      name: skill.metadata.name,
      description: skill.metadata.description,
      path: skill.path,
      usage: normalizeSkillUsageEntry(usage.skills[skillName]),
    });
  }

  skills.sort((left, right) => left.skill.localeCompare(right.skill));

  return {
    profile: profileName,
    skills,
  };
}

async function viewSkill(skillName, requestedName) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const skill = await readSkill(profileName, skillName);
  const timestamp = new Date().toISOString();

  await updateSkillUsage(profileName, skillName, "view", timestamp);

  return {
    profile: profileName,
    skill: skillName,
    path: skill.path,
    raw: skill.raw,
    metadata: skill.metadata,
  };
}

async function createSkill(skillName, requestedName) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const skillPath = getSkillPath(profileName, skillName);
  const skillMarkdownPath = getSkillMarkdownPath(profileName, skillName);
  const lockPath = `${skillPath}.lock`;

  return withFileLock(lockPath, async () => {
    if (await pathExists(skillPath)) {
      throw new SLAError(`Skill '${skillName}' already exists in profile '${profileName}'.`, {
        code: "SKILL_ALREADY_EXISTS",
        exitCode: 2,
        details: { profile: profileName, skill: skillName, path: skillPath },
      });
    }

    await ensureDirectory(skillPath);
    await ensureManagedSkillSubdirectories(skillPath);
    const raw = buildDefaultSkillContent(skillName);
    validateSkillContent(raw);
    await writeFileAtomic(skillMarkdownPath, raw);

    const timestamp = new Date().toISOString();
    await updateSkillUsage(profileName, skillName, "edit", timestamp);

    return {
      profile: profileName,
      skill: skillName,
      path: skillMarkdownPath,
      raw,
      metadata: parseSkillContent(raw).metadata,
    };
  });
}

async function createSkillReference(skillName, requestedName, options) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const skillPath = getSkillPath(profileName, skillName);
  const skillMarkdownPath = await assertSkillExists(profileName, skillName);
  const lockPath = `${skillPath}.lock`;
  const referenceRelativePath = normalizeReferenceFilePath(options.path);
  const referencePath = resolveManagedWritePath(skillMarkdownPath, "references", referenceRelativePath);

  return withFileLock(lockPath, async () => {
    await ensureDirectory(path.dirname(referencePath.absolutePath));
    const raw = await resolveReferenceContent(skillName, options);
    await writeFileAtomic(referencePath.absolutePath, raw);

    const timestamp = new Date().toISOString();
    await updateSkillUsage(profileName, skillName, "edit", timestamp);

    return {
      profile: profileName,
      skill: skillName,
      path: referencePath.relativePath,
      absolutePath: referencePath.absolutePath,
      title: extractReferenceTitle(raw),
      source: describeReferenceSource(options),
    };
  });
}

async function editSkill(skillName, requestedName, options) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const source = resolveContentSource(options, "INVALID_SKILL_INPUT");
  const skillPath = getSkillPath(profileName, skillName);
  const skillMarkdownPath = await assertSkillExists(profileName, skillName);
  const lockPath = `${skillPath}.lock`;

  return withFileLock(lockPath, async () => {
    const raw = normalizeDocumentContent(await readContentSource(source), "Skill content may not be empty.", "INVALID_SKILL_CONTENT");
    const metadata = validateSkillContent(raw);

    await writeFileAtomic(skillMarkdownPath, raw);
    const timestamp = new Date().toISOString();
    await updateSkillUsage(profileName, skillName, "edit", timestamp);

    return {
      profile: profileName,
      skill: skillName,
      path: skillMarkdownPath,
      source: source.type,
      raw,
      metadata,
    };
  });
}

async function deleteSkill(skillName, requestedName) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const skillPath = getSkillPath(profileName, skillName);
  const lockPath = `${skillPath}.lock`;

  return withFileLock(lockPath, async () => {
    await assertSkillExists(profileName, skillName);
    await fs.rm(skillPath, { recursive: true, force: false });
    await removeSkillUsage(profileName, skillName);

    return {
      profile: profileName,
      deletedSkill: skillName,
      path: skillPath,
    };
  });
}

async function writeSkillFile(skillName, requestedName, options) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const source = resolveContentSource(options, "INVALID_SKILL_FILE_INPUT");
  const skillPath = getSkillPath(profileName, skillName);
  const skillMarkdownPath = await assertSkillExists(profileName, skillName);
  const managedPath = resolveManagedWritePath(skillMarkdownPath, options.subdir, options.path);
  const lockPath = `${skillPath}.lock`;

  return withFileLock(lockPath, async () => {
    const raw = normalizeDocumentContent(await readContentSource(source), "Managed file content may not be empty.", "INVALID_SKILL_FILE_CONTENT");
    await ensureDirectory(path.dirname(managedPath.absolutePath));
    await writeFileAtomic(managedPath.absolutePath, raw);

    const timestamp = new Date().toISOString();
    await updateSkillUsage(profileName, skillName, "edit", timestamp);

    return {
      profile: profileName,
      skill: skillName,
      subdir: options.subdir,
      path: managedPath.relativePath,
      absolutePath: managedPath.absolutePath,
      source: source.type,
    };
  });
}

async function removeSkillFile(skillName, requestedName, relativePath) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const skillPath = getSkillPath(profileName, skillName);
  const skillMarkdownPath = await assertSkillExists(profileName, skillName);
  const managedPath = resolveManagedExistingPath(skillMarkdownPath, relativePath);
  const lockPath = `${skillPath}.lock`;

  return withFileLock(lockPath, async () => {
    if (!(await pathExists(managedPath.absolutePath))) {
      throw new SLAError("Managed skill file was not found.", {
        code: "SKILL_FILE_NOT_FOUND",
        exitCode: 1,
        details: {
          profile: profileName,
          skill: skillName,
          path: managedPath.relativePath,
        },
      });
    }

    await fs.rm(managedPath.absolutePath, { force: false });
    const timestamp = new Date().toISOString();
    await updateSkillUsage(profileName, skillName, "edit", timestamp);

    return {
      profile: profileName,
      skill: skillName,
      path: managedPath.relativePath,
      absolutePath: managedPath.absolutePath,
    };
  });
}

async function readSkill(profileName, skillName) {
  const skillMarkdownPath = await assertSkillExists(profileName, skillName);
  const raw = await fs.readFile(skillMarkdownPath, "utf8");
  const parsed = parseSkillContent(raw);

  return {
    ...parsed,
    path: skillMarkdownPath,
  };
}

async function assertSkillExists(profileName, skillName) {
  const skillMarkdownPath = getSkillMarkdownPath(profileName, skillName);
  if (await pathExists(skillMarkdownPath)) {
    return skillMarkdownPath;
  }

  throw new SLAError(`Skill '${skillName}' does not exist in profile '${profileName}'.`, {
    code: "SKILL_NOT_FOUND",
    exitCode: 1,
    details: { profile: profileName, skill: skillName, path: skillMarkdownPath },
  });
}

function buildDefaultSkillContent(skillName) {
  return [
    "---",
    `name: ${skillName}`,
    "description: TODO: describe this skill.",
    "---",
    "",
    `# ${skillName}`,
    "",
    "## Purpose",
    "",
    "Describe the reusable procedure this skill owns.",
    "",
    "## Workflow",
    "",
    "List the repeatable steps, decision points, and commands here.",
    "",
    "## References",
    "",
    "- Put deep repo context, incident analysis, architecture notes, and implementation plans in `references/*.md`.",
    "",
  ].join("\n");
}

function buildDefaultReferenceContent(skillName, title) {
  return [
    `# ${title}`,
    "",
    `Reference document for the \`${skillName}\` skill.`,
    "",
    "## Summary",
    "",
    "Capture the durable repo-specific context this skill depends on.",
    "",
    "## Details",
    "",
    "Add architecture notes, environment mappings, incident analysis, file maps, API shapes, or implementation plans here.",
    "",
  ].join("\n");
}

function validateSkillContent(raw) {
  return parseSkillContent(raw).metadata;
}

function parseSkillContent(raw) {
  const normalized = normalizeDocumentContent(raw, "Skill content may not be empty.", "INVALID_SKILL_CONTENT");
  if (!normalized.startsWith(`${FRONTMATTER_DELIMITER}\n`)) {
    throw new SLAError("SKILL.md must start with YAML frontmatter.", {
      code: "INVALID_SKILL_FRONTMATTER",
      exitCode: 2,
    });
  }

  const delimiterIndex = normalized.indexOf(`\n${FRONTMATTER_DELIMITER}\n`, FRONTMATTER_DELIMITER.length + 1);
  if (delimiterIndex === -1) {
    throw new SLAError("SKILL.md frontmatter must end with a closing --- line.", {
      code: "INVALID_SKILL_FRONTMATTER",
      exitCode: 2,
    });
  }

  const frontmatterRaw = normalized.slice(FRONTMATTER_DELIMITER.length + 1, delimiterIndex);
  const body = normalized.slice(delimiterIndex + `\n${FRONTMATTER_DELIMITER}\n`.length);
  const metadata = parseFrontmatter(frontmatterRaw);

  return {
    raw: normalized,
    metadata,
    body,
  };
}

function parseFrontmatter(frontmatterRaw) {
  const metadata = {};

  for (const line of frontmatterRaw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex <= 0) {
      throw new SLAError("SKILL.md frontmatter must use 'key: value' entries.", {
        code: "INVALID_SKILL_FRONTMATTER",
        exitCode: 2,
      });
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    metadata[key] = value;
  }

  if (!metadata.name) {
    throw new SLAError("SKILL.md frontmatter must include 'name'.", {
      code: "INVALID_SKILL_FRONTMATTER",
      exitCode: 2,
    });
  }

  if (!metadata.description) {
    throw new SLAError("SKILL.md frontmatter must include 'description'.", {
      code: "INVALID_SKILL_FRONTMATTER",
      exitCode: 2,
    });
  }

  return metadata;
}

function normalizeSkillUsageEntry(skillUsage) {
  const input = skillUsage && typeof skillUsage === "object" ? skillUsage : {};

  return {
    viewCount: Number.isInteger(input.viewCount) ? input.viewCount : 0,
    lastViewedAt: input.lastViewedAt ?? null,
    editCount: Number.isInteger(input.editCount) ? input.editCount : 0,
    lastEditedAt: input.lastEditedAt ?? null,
    useCount: Number.isInteger(input.useCount) ? input.useCount : 0,
    lastUsedAt: input.lastUsedAt ?? null,
    lastActivityAt: input.lastActivityAt ?? null,
    lastOperation: input.lastOperation ?? null,
  };
}

function resolveManagedWritePath(skillMarkdownPath, subdir, relativePath) {
  assertAllowedSubdir(subdir);
  const skillDirectory = path.dirname(skillMarkdownPath);
  const normalizedRelativePath = normalizeManagedPath(relativePath);
  const absolutePath = path.join(skillDirectory, subdir, normalizedRelativePath);

  return {
    relativePath: path.posix.join(subdir, normalizedRelativePath),
    absolutePath,
  };
}

function resolveManagedExistingPath(skillMarkdownPath, relativePath) {
  const skillDirectory = path.dirname(skillMarkdownPath);
  const normalizedRelativePath = normalizeManagedPath(relativePath);
  const segments = normalizedRelativePath.split("/");
  const subdir = segments[0];

  assertAllowedSubdir(subdir);

  if (segments.length < 2) {
    throw new SLAError("Managed file paths must include a file inside an allowed subdirectory.", {
      code: "INVALID_MANAGED_PATH",
      exitCode: 2,
      details: { value: relativePath },
    });
  }

  return {
    relativePath: normalizedRelativePath,
    absolutePath: path.join(skillDirectory, ...segments),
  };
}

function normalizeManagedPath(relativePath) {
  const normalized = String(relativePath).replaceAll(path.sep, "/");
  const segments = normalized.split("/").filter(Boolean);

  if (segments.length === 0 || segments.includes("..") || segments.includes(".")) {
    throw new SLAError("Managed file paths may not escape the skill directory.", {
      code: "INVALID_MANAGED_PATH",
      exitCode: 2,
      details: { value: relativePath },
    });
  }

  return segments.join("/");
}

function assertAllowedSubdir(subdir) {
  if (!ALLOWED_MANAGED_SUBDIRS.has(subdir)) {
    throw new SLAError("Managed files must live inside references, templates, scripts, or assets.", {
      code: "INVALID_SKILL_SUBDIR",
      exitCode: 2,
      details: { value: subdir },
    });
  }
}

async function ensureManagedSkillSubdirectories(skillPath) {
  for (const subdir of ALLOWED_MANAGED_SUBDIRS) {
    await ensureDirectory(path.join(skillPath, subdir));
  }
}

async function resolveReferenceContent(skillName, options = {}) {
  const hasFile = Boolean(options.file);
  const hasStdin = Boolean(options.stdin);

  if (hasFile || hasStdin) {
    const source = resolveContentSource(options, "INVALID_SKILL_REFERENCE_INPUT");
    return normalizeDocumentContent(
      await readContentSource(source),
      "Reference content may not be empty.",
      "INVALID_SKILL_REFERENCE_CONTENT",
    );
  }

  const title = normalizeReferenceTitle(options.title);
  return buildDefaultReferenceContent(skillName, title);
}

function normalizeReferenceTitle(title) {
  const normalized = String(title || "").trim();
  if (!normalized) {
    throw new SLAError("Reference title is required when --file or --stdin is not provided.", {
      code: "INVALID_SKILL_REFERENCE_TITLE",
      exitCode: 2,
      details: { title: title ?? null },
    });
  }

  return normalized;
}

function normalizeReferenceFilePath(relativePath) {
  const normalized = normalizeManagedPath(relativePath);
  if (!normalized.toLowerCase().endsWith(".md")) {
    throw new SLAError("Reference files must use a .md path.", {
      code: "INVALID_SKILL_REFERENCE_PATH",
      exitCode: 2,
      details: { value: relativePath },
    });
  }

  return normalized;
}

function extractReferenceTitle(raw) {
  const firstHeading = raw
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));

  return firstHeading ? firstHeading.slice(2).trim() : null;
}

function describeReferenceSource(options = {}) {
  if (options.file) {
    return "file";
  }

  if (options.stdin) {
    return "stdin";
  }

  return "generated";
}

function resolveContentSource(options = {}, code) {
  const hasFile = Boolean(options.file);
  const hasStdin = Boolean(options.stdin);

  if (hasFile === hasStdin) {
    throw new SLAError("Provide exactly one input source: --file or --stdin.", {
      code,
      exitCode: 2,
      details: {
        file: options.file ?? null,
        stdin: hasStdin,
      },
    });
  }

  if (hasFile) {
    return {
      type: "file",
      path: options.file,
    };
  }

  return {
    type: "stdin",
  };
}

async function readContentSource(source) {
  if (source.type === "file") {
    return fs.readFile(source.path, "utf8");
  }

  return fs.readFile("/dev/stdin", "utf8");
}

function normalizeDocumentContent(content, message, code) {
  const normalized = String(content).replaceAll("\r\n", "\n").trim();
  if (!normalized) {
    throw new SLAError(message, {
      code,
      exitCode: 2,
    });
  }

  return `${normalized}\n`;
}

module.exports = {
  createSkillReference,
  createSkill,
  deleteSkill,
  editSkill,
  listSkills,
  removeSkillFile,
  viewSkill,
  writeSkillFile,
};
