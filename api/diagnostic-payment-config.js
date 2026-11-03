const handler = require("../api-handlers/payments/config");
module.exports = function diagnosticPaymentConfig(req, res) {
  return handler(req, res);
};
