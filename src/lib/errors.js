class SLAError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "SLAError";
    this.code = options.code || "SLA_ERROR";
    this.exitCode = options.exitCode || 1;
    this.details = options.details || null;
  }
}

module.exports = {
  SLAError,
};
