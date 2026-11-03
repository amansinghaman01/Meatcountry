const handler = require("../api-handlers/products");
module.exports = async function diagnosticProducts(req, res) {
  return handler(req, res);
};
