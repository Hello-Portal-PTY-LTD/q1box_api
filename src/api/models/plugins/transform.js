const mongoose = require("mongoose");

// Plugin to rename _id to id and exclude certain fields
const excludeFieldsPlugin = (schema) => {
  // Rename _id to id
  schema.set("toJSON", {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id;
    },
  });

  // Exclude fields from JSON output
  schema.options.toJSON.transform = function (doc, ret) {
    // Exclude createdAt, updatedAt, and __v
    // delete ret.createdAt;
    // delete ret.updatedAt;
    delete ret.__v;
    delete ret._id;
    delete ret.password;
  };
};

module.exports = excludeFieldsPlugin;
