const fs = require("node:fs/promises");
const path = require("node:path");
const { SLAError } = require("./errors");

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function ensureDirectory(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function writeFileAtomic(targetPath, content) {
  const directory = path.dirname(targetPath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`,
  );

  await ensureDirectory(directory);
  await fs.writeFile(temporaryPath, content, "utf8");
  await fs.rename(temporaryPath, targetPath);
}

async function writeFileIfMissing(targetPath, content) {
  try {
    await fs.writeFile(targetPath, content, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (error) {
    if (error && error.code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

async function withFileLock(lockPath, operation, options = {}) {
  const retryDelayMs = options.retryDelayMs ?? 25;
  const timeoutMs = options.timeoutMs ?? 2000;
  const startedAt = Date.now();

  while (true) {
    try {
      const handle = await fs.open(lockPath, "wx");
      try {
        return await operation();
      } finally {
        await handle.close();
        await fs.rm(lockPath, { force: true });
      }
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new SLAError("Timed out waiting for an internal file lock.", {
          code: "LOCK_TIMEOUT",
          exitCode: 1,
          details: { lockPath, timeoutMs },
        });
      }

      await sleep(retryDelayMs);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  ensureDirectory,
  pathExists,
  withFileLock,
  writeFileAtomic,
  writeFileIfMissing,
};
