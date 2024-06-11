const Joi = require("joi");
const Folder = require("../models/folder.model");

module.exports = {
  // GET /v1/folder/:userId
  listFolders: {
    params: {
      userId: Joi.string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .required(),
    },
  },

  // POST /v1/folder
  createFolder: {
    body: Joi.object({
      name: Joi.string().required(),
      owner: Joi.string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .required(),
    }),
  },

  // PATCH /v1/folder/:folderId
  updateFolder: {
    body: Joi.object({
      name: Joi.string(),
      owner: Joi.string().regex(/^[a-fA-F0-9]{24}$/),
    }),
    params: {
      folderId: Joi.string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .required(),
    },
  },

  // Get /v1/folder/:folderId
  getFolder: {
    params: {
      folderId: Joi.string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .required(),
    },
  },

  // DELETE /v1/folder/:folderId
  deleteFolder: {
    params: {
      folderId: Joi.string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .required(),
    },
  },
};
