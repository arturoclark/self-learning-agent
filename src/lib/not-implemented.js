const { SLEError } = require("./errors");
const { writeResult } = require("./output");

function notImplemented(command, operation, detail) {
  const payload = {
    ok: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: "This command is not implemented yet.",
      operation,
      detail,
    },
  };

  return writeResult(command, payload, {
    human: `${payload.error.message} ${detail}`,
    error: new SLEError(payload.error.message, {
      code: payload.error.code,
      exitCode: 1,
      details: { operation, detail },
    }),
  });
}

module.exports = {
  notImplemented,
};
