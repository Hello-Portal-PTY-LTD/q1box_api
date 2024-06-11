const mongoose = require("mongoose");

const Banner = new mongoose.Schema(
  {
    status: {
      type: Boolean,
      default: false,
    },
    bannerTitle: {
      type: String,
    },
    discountCode: {
      type: String,
      default: "",
    },
    couponRedeemBy: {
      type: String,
      default: "",
    },
    announcement: {
      type: String,
    },
    bgColor: {
      type: String,
    },
  },
  {
    // strict: false,
    timestamps: true,
  }
);

module.exports = mongoose.model("Banner", Banner);
