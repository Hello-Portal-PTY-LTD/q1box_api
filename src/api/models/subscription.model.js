const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscriptionId: { type: String, required: false },
    planName: { type: String, required: false },
    annualPurchase: { type: Boolean, required: false },
    stripePriceId: { type: String, required: false },
    appliedToCancel: { type: Boolean, required: false },
    stripeSubscriptionStatus: { type: String },
    subscriptionPausedByAdmin: { type: Boolean, default: false },
    sessionId: {
      type: String,
    },
    amount: { type: Number, required: false },
    stripePaidAmount: { type: Number, required: false },
    paymentStatus: {
      type: String,
      required: false,
      enum: ["PENDING", "SUCCESS", "FAIL"],
    },
    customerDetails: {
      city: { type: String },
      country: { type: String },
      line1: { type: String },
      line2: { type: String },
      postal_code: { type: String },
      state: { type: String },
    },
    cardDetails: {
      brand: { type: String },
      last4: { type: Number },
    },

    stripeSubscriptionPaid: {
      type: Boolean,
    },
    stripeCustomerId: { type: String },
  },
  {
    timestamps: true,
  }
);

const Subscription = mongoose.model("subscriptions", subscriptionSchema);

module.exports = Subscription;
