const router = require("express").Router();
const Banner = require("../../models/banner");
const { authorize } = require("../../middlewares/auth");

const addBanner = async (req, res) => {
  try {
    const {
      announcement,
      discountCode,
      bannerTitle,
      status,
      couponRedeemBy,
      bgColor,
    } = req.body;

    await Banner.deleteMany({});
    let banner = { announcement, bannerTitle, status, bgColor };
    if (announcement === "coupon") {
      banner.discountCode = discountCode;
      banner.couponRedeemBy = couponRedeemBy;
    }
    await Banner.create(banner);
    return res.status(200).json({ status: 200, data: "Successfully Updated" });
  } catch (error) {
    res
      .status(error.statusCode ?? error.status ?? 400)
      .json({ message: error.message });
  }
};

const getBanner = async (req, res) => {
  try {
    let banner = await Banner.find({});

    return res.status(200).json({ status: 200, data: banner });
  } catch (error) {
    res
      .status(error.statusCode ?? error.status ?? 400)
      .json({ message: error.message });
  }
};

router.route("/addbanner").post(authorize(), addBanner);
router.route("/getbanner").get(authorize(), getBanner);

module.exports = router;
