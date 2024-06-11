const Joi = require("joi");

module.exports = {
  //   // GET /v1/folder/:userId
  listLabels: {
    params: {
      userId: Joi.string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .required(),
    },
  },

  // POST /v1/label
  createLabel: {
    body: Joi.object({
      name: Joi.string().required(),
      owner: Joi.string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .required(),
    }),
  },

  //   // PATCH /v1/label/:leabelId
  updateLabel: {
    body: Joi.object({
      name: Joi.string(),
      owner: Joi.string().regex(/^[a-fA-F0-9]{24}$/),
    }),
    params: {
      labelId: Joi.string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .required(),
    },
  },

  // Get /v1/label/:labelId
  getLabel: {
    params: {
      labelId: Joi.string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .required(),
    },
  },

  //   // DELETE /v1/folder/:folderId
  deleteLabel: {
    params: {
      labelId: Joi.string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .required(),
    },
  },
};
