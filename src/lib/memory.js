const fs = require("node:fs/promises");
const { SLEError } = require("./errors");
const { withFileLock, writeFileAtomic } = require("./filesystem");
const { getMemoryStorePath } = require("./paths");
const { resolveExistingProfile } = require("./profiles");
const { updateMemoryUsage } = require("./usage");

const MEMORY_HEADERS = {
  memory: "# MEMORY",
  user: "# USER",
};

const ENTRY_DELIMITER = "\n\n---\n\n";

async function listMemoryEntries(requestedName) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const memoryEntries = await readMemoryTarget(profileName, "memory");
  const userEntries = await readMemoryTarget(profileName, "user");

  return {
    profile: profileName,
    targets: [
      {
        target: "memory",
        entryCount: memoryEntries.entries.length,
        entries: memoryEntries.entries,
      },
      {
        target: "user",
        entryCount: userEntries.entries.length,
        entries: userEntries.entries,
      },
    ],
  };
}

async function viewMemoryTarget(requestedName, target) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const memoryData = await readMemoryTarget(profileName, target);

  return {
    profile: profileName,
    target,
    entryCount: memoryData.entries.length,
    entries: memoryData.entries,
    raw: memoryData.raw,
    path: getMemoryStorePath(profileName, target),
  };
}

async function addMemoryEntry(requestedName, target, entry) {
  return mutateMemoryTarget(requestedName, target, "add", (entries, normalizedEntry) => {
    if (entries.some((currentEntry) => currentEntry === normalizedEntry)) {
      throw new SLEError("That memory entry already exists in the selected target.", {
        code: "MEMORY_ENTRY_ALREADY_EXISTS",
        exitCode: 2,
        details: { target, entry: normalizedEntry },
      });
    }

    return {
      nextEntries: [...entries, normalizedEntry],
      matchedEntry: null,
    };
  }, entry);
}

async function replaceMemoryEntry(requestedName, target, match, entry) {
  return mutateMemoryTarget(
    requestedName,
    target,
    "replace",
    (entries, normalizedEntry) => {
      const matchResult = findSingleMatch(entries, normalizeEntry(match), target);
      if (
        entries.some((currentEntry, index) => currentEntry === normalizedEntry && index !== matchResult.index)
      ) {
        throw new SLEError("That replacement would create a duplicate memory entry.", {
          code: "MEMORY_ENTRY_ALREADY_EXISTS",
          exitCode: 2,
          details: { target, entry: normalizedEntry },
        });
      }

      const nextEntries = [...entries];
      nextEntries[matchResult.index] = normalizedEntry;

      return {
        nextEntries,
        matchedEntry: matchResult.entry,
      };
    },
    entry,
  );
}

async function removeMemoryEntry(requestedName, target, match) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const storePath = getMemoryStorePath(profileName, target);
  const lockPath = `${storePath}.lock`;

  return withFileLock(lockPath, async () => {
    const current = await readMemoryTarget(profileName, target);
    const matchResult = findSingleMatch(current.entries, normalizeEntry(match), target);
    const nextEntries = current.entries.filter((_, index) => index !== matchResult.index);
    const raw = serializeMemoryTarget(target, nextEntries);
    const timestamp = new Date().toISOString();

    await writeFileAtomic(storePath, raw);
    await updateMemoryUsage(profileName, {
      target,
      operation: "remove",
      entryCount: nextEntries.length,
      timestamp,
    });

    return {
      profile: profileName,
      target,
      removedEntry: matchResult.entry,
      entryCount: nextEntries.length,
      path: storePath,
    };
  });
}

async function mutateMemoryTarget(requestedName, target, operation, transformEntries, entry) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const storePath = getMemoryStorePath(profileName, target);
  const lockPath = `${storePath}.lock`;
  const normalizedEntry = normalizeEntry(entry);

  return withFileLock(lockPath, async () => {
    const current = await readMemoryTarget(profileName, target);
    const transformed = transformEntries(current.entries, normalizedEntry);
    const raw = serializeMemoryTarget(target, transformed.nextEntries);
    const timestamp = new Date().toISOString();

    await writeFileAtomic(storePath, raw);
    await updateMemoryUsage(profileName, {
      target,
      operation,
      entryCount: transformed.nextEntries.length,
      timestamp,
    });

    return {
      profile: profileName,
      target,
      entry: normalizedEntry,
      previousEntry: transformed.matchedEntry,
      entryCount: transformed.nextEntries.length,
      path: storePath,
    };
  });
}

async function readMemoryTarget(profileName, target) {
  const storePath = getMemoryStorePath(profileName, target);
  const raw = await fs.readFile(storePath, "utf8");
  const entries = parseMemoryTarget(raw, target);

  return {
    raw,
    entries,
    path: storePath,
  };
}

function parseMemoryTarget(raw, target) {
  const normalized = raw.replaceAll("\r\n", "\n");
  const header = MEMORY_HEADERS[target];
  if (!normalized.startsWith(header)) {
    return [];
  }

  const remainder = normalized.slice(header.length).trim();
  if (!remainder) {
    return [];
  }

  return remainder
    .split(/\n\n---\n\n/g)
    .map((entry) => normalizeEntry(entry))
    .filter(Boolean);
}

function serializeMemoryTarget(target, entries) {
  const header = MEMORY_HEADERS[target];
  if (entries.length === 0) {
    return `${header}\n`;
  }

  return `${header}\n\n${entries.join(ENTRY_DELIMITER)}\n`;
}

function normalizeEntry(entry) {
  const normalized = String(entry).replaceAll("\r\n", "\n").trim();
  if (!normalized) {
    throw new SLEError("Memory entry content may not be empty.", {
      code: "INVALID_MEMORY_ENTRY",
      exitCode: 2,
    });
  }

  return normalized;
}

function findSingleMatch(entries, match, target) {
  const matches = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.includes(match));

  if (matches.length === 0) {
    throw new SLEError("No memory entry matched the provided text.", {
      code: "MEMORY_ENTRY_NOT_FOUND",
      exitCode: 1,
      details: { target, match },
    });
  }

  if (matches.length > 1) {
    throw new SLEError("Multiple memory entries matched the provided text.", {
      code: "MEMORY_ENTRY_AMBIGUOUS",
      exitCode: 1,
      details: {
        target,
        match,
        matches: matches.map((item) => item.entry),
      },
    });
  }

  return matches[0];
}

module.exports = {
  addMemoryEntry,
  listMemoryEntries,
  removeMemoryEntry,
  replaceMemoryEntry,
  viewMemoryTarget,
};
