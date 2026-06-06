function attachExamples(examples) {
  const body = examples.map((example) => `  ${example}`).join("\n");
  return `\nExamples:\n${body}\n`;
}

module.exports = {
  attachExamples,
};
