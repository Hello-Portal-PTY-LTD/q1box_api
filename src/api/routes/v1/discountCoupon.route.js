const express = require("express");
const controller = require("../../controllers/discountCoupon");

const router = express.Router();

router.route("/create-coupon").post(controller.createCoupons);
router.route("/get-all-coupons").get(controller.getAllCoupons);
router.route("/get-all-coupons-at-once").get(controller.getAllCouponsAtOnce);
router.route("/check-coupon-validity").post(controller.checkCouponValidity);

module.exports = router;
