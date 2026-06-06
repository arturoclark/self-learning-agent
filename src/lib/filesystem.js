const fs = require("node:fs/promises");
const path = require("node:path");

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

module.exports = {
  ensureDirectory,
  pathExists,
  writeFileAtomic,
  writeFileIfMissing,
};
