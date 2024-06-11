const express = require("express");
const subscription = require("../../controllers/subscription");
const {
  authorize,
  SUPER_ADMIN,
  ADMIN,
  LOGGED_USER,
} = require("../../middlewares/auth");

const router = express.Router();

/**
 * GET v1/status
 */
router.get(
  "/allsubscriptions",
  authorize(),
  subscription.getAllSubscriptionDetails
);

router.get(
  "/transactions/:userId",
  authorize(),
  subscription.getCustomerInvoices
);
router.get("/subscription/:id", authorize(), subscription.getSubscriptionById);
router.post("/create-plan", authorize(), subscription.createSubscriptionPlan);
router.post("/create-product", authorize(), subscription.createCustomProduct);
router.post("/update-plan", authorize(), subscription.changeSubscriptionPlan);
router.post("/cancel-plan", authorize(), subscription.cancelSubscribedPlan);
router.get("/stripe-plan", authorize(), subscription.cancelSubscribedPlan);
router.get("/subscription-info", authorize(), subscription.subscriptionInfo);

router.post("/get-info", subscription.getCardDetails);

router.post(
  "/custom-subscription",
  authorize(),
  subscription.createCustomSubscription
);

router.get("/get-plan", authorize(), subscription.getSubscribedPlan);
router.post("/pause-resume", authorize(), subscription.pauseResumeSubscription);

module.exports = router;
