const express = require("express");
const userRoutes = require("./user.route");
const subscriptionRoutes = require("./subscription.route");
const authRoutes = require("./auth.route");
const qrRoutes = require("./qr.route");
const analyticsRoutes = require("./analytics.route");
const templateRoutes = require("./template.route");
const folderRoutes = require("./folder.route");
const labelRoutes = require("./label.route");
const resourceRoutes = require("./resource.route");
const discountCouponRoutes = require("./discountCoupon.route");
const bannerRoutes = require("./banner");

const { stripeWebHook } = require("../../controllers/stripeWebHook");

const router = express.Router();

/**
 * GET v1/status
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebHook
);

router.get("/status", (req, res) => res.send("OK"));
router.use("/users", userRoutes);
router.use("/plan", subscriptionRoutes);
router.use("/auth", authRoutes);
router.use("/qr", qrRoutes);
router.use("/template", templateRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/folder", folderRoutes);
router.use("/label", labelRoutes);

router.use("/resource", resourceRoutes);
router.use("/coupon", discountCouponRoutes);
router.use("/banner", bannerRoutes);

module.exports = router;
