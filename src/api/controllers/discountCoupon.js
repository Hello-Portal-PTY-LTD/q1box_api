const httpStatus = require("http-status");
const APIError = require("../errors/api-error");
const discountCoupon = require("../models/discountCoupon");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

module.exports.createCoupons = async (req, res, next) => {
  try {
    const {
      max_redemptions,
      redeem_by,
      couponName,
      percent_off,
      amount_off,
      duration,
      months_in_duration,
      couponFor,
      couponForPlan,
      couponForEmail,
    } = req.body;

    let existingCoupon = await discountCoupon.findOne({ name: couponName });

    if (existingCoupon) {
      throw new APIError({
        status: httpStatus.NOT_FOUND,
        message: "Coupon Name Alredy exists",
      });
    }

    const specificDate = new Date(redeem_by);

    // Set time to 23:59:59
    specificDate.setHours(23, 59, 59, 999);

    // Convert to Unix timestamp in UTC (seconds since epoch)
    const unixTimestampUTC = Math.floor(
      Date.UTC(
        specificDate.getUTCFullYear(),
        specificDate.getUTCMonth(),
        specificDate.getUTCDate(),
        specificDate.getUTCHours(),
        specificDate.getUTCMinutes(),
        specificDate.getUTCSeconds(),
        specificDate.getUTCMilliseconds()
      ) / 1000
    );

    let stripeObj = {
      max_redemptions: parseInt(max_redemptions),
      redeem_by: unixTimestampUTC,
      name: couponName,
      percent_off: parseInt(percent_off),
      amount_off: amount_off ? parseInt(amount_off) * 100 : null,
      duration,
    };

    if (duration === "repeating") {
      stripeObj.duration_in_months = months_in_duration;
    }
    if (amount_off) {
      stripeObj.currency = "AUD";
      delete stripeObj.percent_off;
    }

    if (percent_off) {
      delete stripeObj.amount_off;
    }

    const couponSaveOnStripe = await stripe.coupons.create(stripeObj);

    if (couponSaveOnStripe) {
      if (couponSaveOnStripe.amount_off)
        couponSaveOnStripe.amount_off = couponSaveOnStripe.amount_off / 100;
      let discountCpn = new discountCoupon({
        ...couponSaveOnStripe,
        couponFor,
        couponForPlan,
        couponForEmail,
      });
      await discountCpn.save();
    }

    res.status(httpStatus.OK);
    res.json({
      couponSaveOnStripe,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllCoupons = async (req, res, next) => {
  try {
    const skip = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;

    const count = await discountCoupon.countDocuments();
    const allCoupon = await discountCoupon
      .find()
      .sort({ createdAt: -1 }) // Sort by createdAt in descending order
      .skip(skip)
      .limit(limit);

    res.status(httpStatus.OK);
    res.json({
      count,
      allCoupon,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllCouponsAtOnce = async (req, res, next) => {
  try {
    const count = await discountCoupon.countDocuments();
    const allCoupon = await discountCoupon.find().sort({ createdAt: -1 }); // Sort by createdAt in descending order

    res.status(httpStatus.OK);
    res.json({
      count,
      allCoupon,
    });
  } catch (error) {
    next(error);
  }
};

exports.checkCouponValidity = async (req, res, next) => {
  try {
    let couponCode = req.body.couponCode;
    let selectedPlan = req.body.selectedPlan;
    if (!couponCode)
      throw new APIError({
        status: httpStatus.NOT_FOUND,
        message: "Coupon field is empty",
      });
    const result = await discountCoupon.findOne({
      $or: [{ id: couponCode }, { name: couponCode }],
    });
    if (!result)
      throw new APIError({
        status: httpStatus.NOT_FOUND,
        message: "Coupon not found",
      });

    if (result.couponForPlan.toLowerCase() !== "all") {
      if (result.couponForPlan.toLowerCase() !== selectedPlan.toLowerCase()) {
        throw new APIError({
          status: httpStatus.NOT_FOUND,
          message: "This Coupon is not for your subscription",
        });
      }
    }

    // check for specific user
    if (result.couponFor === "onlyOneUser") {
      if (result.couponForEmail != req.user?.email) {
        throw new APIError({
          status: httpStatus.NOT_FOUND,
          message: "This Coupon is not for you",
        });
      }
    }

    // check if user is already avail this coupon
    const existingId = await discountCoupon.findOne({
      _id: result._id,
      usedBy: { $in: [req.user?._id] },
    });
    if (existingId)
      throw new APIError({
        status: httpStatus.NOT_FOUND,
        message: "You have already used this coupon",
      });

    const checkCouponFormStripe = await stripe.coupons.retrieve(result?.id);

    if (!checkCouponFormStripe)
      throw new APIError({
        status: httpStatus.NOT_FOUND,
        message: "No Such coupon is available",
      });

    if (!checkCouponFormStripe.valid)
      throw new APIError({
        status: httpStatus.NOT_FOUND,
        message: "This coupon is expired",
      });

    res.status(httpStatus.OK);
    res.json({
      coupon: checkCouponFormStripe,
      message: "Coupon accepted",
    });
  } catch (error) {
    next(error);
  }
};
