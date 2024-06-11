const Joi = require("joi");

module.exports = {
  create: {
    body: {
      qrId: Joi.string()
      .required(),
      browser: Joi.string().required(),
      device: Joi.string().required(),
      location: {
        city: Joi.string(),
        country: Joi.string(),
        code: Joi.string(),
      },
      scanDate: Joi.date(),
    },
  },
  timeBased: {
    query: {
      timePeriod: Joi.string().valid("hour", "day", "month", "year").required(),
      userId: Joi.string().regex(/^[a-fA-F0-9]{24}$/),
      qrId: Joi.string().regex(/^[a-fA-F0-9]{24}$/),
    },
    middleware: (req, res, next) => {
      const { userId, qrId } = req.query;
      if (!userId && !qrId) {
        return res
          .status(400)
          .json({ error: "Either userId or qrId must be provided." });
      }

      return next();
    },
  },
  analyticsById: {
    query: {
      userId: Joi.string().regex(/^[a-fA-F0-9]{24}$/),
      qrId: Joi.string().regex(/^[a-fA-F0-9]{24}$/),
    },
    middleware: (req, res, next) => {
      const { userId, qrId } = req.query;
      if (!userId && !qrId) {
        return res
          .status(400)
          .json({ error: "Either userId or qrId must be provided." });
      }
      return next();
    },
  },
  scanCount: {
    query: {
      userId: Joi.string().regex(/^[a-fA-F0-9]{24}$/),
      qrId: Joi.string().regex(/^[a-fA-F0-9]{24}$/),
      timePeriod: Joi.string().valid("month", "week", "year"),
    },
  },
  query: {
    query: {
      userId: Joi.string().regex(/^[a-fA-F0-9]{24}$/),
      qrId: Joi.string().regex(/^[a-fA-F0-9]{24}$/),
      groupBy: Joi.string().valid(
        "qrType",
        "city",
        "device",
        "browser",
        "country"
      ),
      timePeriod: Joi.string().valid("month", "week", "year"),
    },
  },
};
