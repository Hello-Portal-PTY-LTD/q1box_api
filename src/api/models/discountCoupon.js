const mongoose = require("mongoose");

const discountCoupon = new mongoose.Schema(
  {
    id: {
      type: String,
    },
    object: {
      type: String,
    },
    amount_off: {
      type: String,
    },

    created: {
      type: Number,
    },
    currency: {
      type: String,
    },
    name: {
      type: String,
      unique: true,
    },
    livemode: {
      type: Boolean,
    },
    duration: {
      type: String,
    },
    duration_in_months: {
      type: String,
    },
    percent_off: {
      type: String,
    },
    max_redemptions: {
      type: String,
    },
    redeem_by: {
      type: String,
    },
    redemptions: {
      type: Number,
      default: 0,
    },
    valid: {
      type: Boolean,
    },
    usedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    couponFor: {
      type: String,
    },
    couponForPlan: {
      type: String,
    },
    couponForEmail: {
      type: String,
    },
  },
  {
    // strict: false,
    timestamps: true,
  }
);

module.exports = mongoose.model("DiscountCoupon", discountCoupon);
