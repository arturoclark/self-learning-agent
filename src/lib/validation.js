const path = require("path");
const { SLEError } = require("./errors");

const PROFILE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
const MEMORY_TARGETS = new Set(["memory", "user"]);
const SKILL_SUBDIRS = new Set(["references", "templates", "scripts", "assets"]);

function validateProfileName(value) {
  if (!PROFILE_NAME_PATTERN.test(value)) {
    throw new SLEError("Profile names may only contain letters, numbers, dot, underscore, and hyphen.", {
      code: "INVALID_PROFILE_NAME",
      exitCode: 2,
      details: { value },
    });
  }

  return value;
}

function validateSkillName(value) {
  if (!SKILL_NAME_PATTERN.test(value)) {
    throw new SLEError("Skill names may only contain letters, numbers, dot, underscore, and hyphen.", {
      code: "INVALID_SKILL_NAME",
      exitCode: 2,
      details: { value },
    });
  }

  return value;
}

function validateMemoryTarget(value) {
  if (!MEMORY_TARGETS.has(value)) {
    throw new SLEError("Memory target must be 'memory' or 'user'.", {
      code: "INVALID_MEMORY_TARGET",
      exitCode: 2,
      details: { value },
    });
  }

  return value;
}

function validateSkillSubdir(value) {
  if (!SKILL_SUBDIRS.has(value)) {
    throw new SLEError("Managed skill subdirectory must be one of references, templates, scripts, or assets.", {
      code: "INVALID_SKILL_SUBDIR",
      exitCode: 2,
      details: { value },
    });
  }

  return value;
}

function validateRelativeManagedPath(value) {
  if (!value || path.isAbsolute(value)) {
    throw new SLEError("Managed file paths must be relative.", {
      code: "INVALID_MANAGED_PATH",
      exitCode: 2,
      details: { value },
    });
  }

  const normalized = path.posix.normalize(value.replaceAll(path.sep, "/"));
  if (normalized.startsWith("../") || normalized === "..") {
    throw new SLEError("Managed file paths may not escape the skill directory.", {
      code: "INVALID_MANAGED_PATH",
      exitCode: 2,
      details: { value },
    });
  }

  return normalized;
}

module.exports = {
  validateMemoryTarget,
  validateProfileName,
  validateRelativeManagedPath,
  validateSkillName,
  validateSkillSubdir,
};
