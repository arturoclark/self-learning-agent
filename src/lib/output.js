const { SLEError } = require("./errors");

function writeResult(command, payload, options = {}) {
  const opts = command.optsWithGlobals ? command.optsWithGlobals() : {};

  if (opts.json) {
    process.stdout.write(`${renderJson(payload)}\n`);
    if (options.error) {
      process.exitCode = options.error.exitCode || 1;
    }
    return;
  }

  if (options.error) {
    throw options.error;
  }

  process.stdout.write(`${options.human || ""}\n`);
}

function renderJson(payload) {
  return JSON.stringify(payload, null, 2);
}

function formatError(error, program) {
  const json = Boolean(program?.opts?.().json);

  if (json) {
    return {
      stream: "stdout",
      exitCode: error.exitCode || 1,
      body: renderJson({
        ok: false,
        error: {
          code: error.code || "ERROR",
          message: error.message,
          details: error.details || null,
        },
      }),
    };
  }

  if (error instanceof SLEError) {
    return {
      stream: "stderr",
      exitCode: error.exitCode,
      body: `${error.code}: ${error.message}`,
    };
  }

  return {
    stream: "stderr",
    exitCode: error.exitCode || 1,
    body: error.message || String(error),
  };
}

module.exports = {
  formatError,
  renderJson,
  writeResult,
};
