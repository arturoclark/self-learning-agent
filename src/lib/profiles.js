const { SLEError } = require("./errors");

function resolveProfileName({ requestedName, config }) {
  if (requestedName) {
    return requestedName;
  }

  if (config?.defaultProfile) {
    return config.defaultProfile;
  }

  throw new SLEError("No profile was provided and no default profile is configured.", {
    code: "DEFAULT_PROFILE_REQUIRED",
    exitCode: 2,
  });
}

module.exports = {
  resolveProfileName,
};
