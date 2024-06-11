const mongoose = require("mongoose");
const excludeFieldsPlugin = require("./plugins/transform");

const analyticsSchema = new mongoose.Schema(
  {
    qrId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QR",
      required: true,
      index: true,
    },
    browser: {
      type: String,
      required: true,
    },
    device: {
      type: String,
      required: true,
    },
    location: {
      city: String,
      country: String,
      code: String,
    },
    scanDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

analyticsSchema.plugin(excludeFieldsPlugin);

const Analytics = mongoose.model("Analytics", analyticsSchema);

module.exports = Analytics;
