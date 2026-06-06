const os = require("os");
const path = require("path");

function getSleHome() {
  return process.env.SLE_HOME || path.join(os.homedir(), ".sle");
}

function getProfilePath(profileName) {
  return path.join(getSleHome(), profileName);
}

module.exports = {
  getProfilePath,
  getSleHome,
};
