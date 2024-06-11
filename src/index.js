// make bluebird default Promise
Promise = require("bluebird"); // eslint-disable-line no-global-assign
const { port, env } = require("./config/vars");

const logger = require("./config/logger");
const app = require("./config/express");
const mongoose = require("./config/mongoose");
const express = require("express");
const { trailExpiryCronJob } = require("./utils/trailExpiryCronJob");

// open mongoose connection
mongoose.connect();

trailExpiryCronJob();
app.use(express.json({ limit: "500mb" }));

app.use(express.urlencoded({ limit: "500mb", extended: true }));

// listen to requests

app.listen(port || 3000, () =>
  logger.info(`server started on port ${port} (${env})`)
);

/**
 * Exports express
 * @public
 */
module.exports = app;
