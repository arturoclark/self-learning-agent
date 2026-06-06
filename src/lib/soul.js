const fs = require("node:fs/promises");
const { SLEError } = require("./errors");
const { withFileLock, writeFileAtomic } = require("./filesystem");
const { getSoulPath } = require("./paths");
const { resolveExistingProfile } = require("./profiles");

async function viewSoul(requestedName) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const soulPath = getSoulPath(profileName);
  const raw = await fs.readFile(soulPath, "utf8");

  return {
    profile: profileName,
    path: soulPath,
    raw,
  };
}

async function editSoul(requestedName, options) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const source = resolveSoulInputSource(options);
  const soulPath = getSoulPath(profileName);
  const lockPath = `${soulPath}.lock`;

  return withFileLock(lockPath, async () => {
    const raw = normalizeSoulContent(await readSoulInput(source));
    await writeFileAtomic(soulPath, raw);

    return {
      profile: profileName,
      path: soulPath,
      source: source.type,
      raw,
    };
  });
}

function resolveSoulInputSource(options = {}) {
  const hasFile = Boolean(options.file);
  const hasStdin = Boolean(options.stdin);

  if (hasFile === hasStdin) {
    throw new SLEError("Provide exactly one input source: --file or --stdin.", {
      code: "INVALID_SOUL_INPUT",
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

async function readSoulInput(source) {
  if (source.type === "file") {
    return fs.readFile(source.path, "utf8");
  }

  return fs.readFile("/dev/stdin", "utf8");
}

function normalizeSoulContent(content) {
  const normalized = String(content).replaceAll("\r\n", "\n").trim();
  if (!normalized) {
    throw new SLEError("SOUL.md content may not be empty.", {
      code: "INVALID_SOUL_CONTENT",
      exitCode: 2,
    });
  }

  return `${normalized}\n`;
}

module.exports = {
  editSoul,
  viewSoul,
};
