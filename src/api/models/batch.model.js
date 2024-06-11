const mongoose = require("mongoose");
const User = require("../models/user.model");
const excludeFieldsPlugin = require("./plugins/transform");

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    count: {
      type: Number,
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },

  {
    timestamps: true,
  }
);

const Batch = mongoose.model("Batch", batchSchema);

module.exports = Batch;
