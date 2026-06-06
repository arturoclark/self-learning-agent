class SLEError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "SLEError";
    this.code = options.code || "SLE_ERROR";
    this.exitCode = options.exitCode || 1;
    this.details = options.details || null;
  }
}

module.exports = {
  SLEError,
};
