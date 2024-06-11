const mongoose = require("mongoose");
const excludeFieldsPlugin = require("./plugins/transform");

const stripeProducts = new mongoose.Schema(
  {
    stripeProductId: {
      type: String,
      required: true,
    },
    priceId: {
      type: String,
      required: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    period: {
      type: Number,
    },
    dynamicQrs: {
      type: Number,
    },
    periodType: {
      type: String,
    },
    amount: {
      type: Number,
    },
    users: {
      type: Number,
    },
    scans: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

stripeProducts.plugin(excludeFieldsPlugin);

const StripeProducts = mongoose.model("StripeProducts", stripeProducts);

module.exports = StripeProducts;
