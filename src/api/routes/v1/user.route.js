const express = require("express");
const validate = require("express-validation");
const controller = require("../../controllers/user.controller");
const subscription = require("../../models/subscription.model");
const stripeProducts = require("../../models/stripeProducts.model");
const mongoose = require("mongoose");
// pages/api/convertImage.js
const fs = require("fs");
const potrace = require("potrace");

const {
  authorize,
  SUPER_ADMIN,
  ADMIN,
  LOGGED_USER,
  SUPER_Editor,
  SUPER_EDITOR,
  SUPER_VIEWER,
  ACTING_SUPER_ADMIN,
} = require("../../middlewares/auth");
const {
  listUsers,
  createUser,
  replaceUser,
  updateUser,
} = require("../../validations/user.validation");

const router = express.Router();

/**
 * Load user when API with userId route parameter is hit
 */
// router.param("userId", controller.load);

router
  .route("/")
  .get(
    authorize([
      ADMIN,
      SUPER_ADMIN,
      SUPER_EDITOR,
      SUPER_VIEWER,
      ACTING_SUPER_ADMIN,
    ]),
    validate(listUsers),
    controller.list
  )
  .post(
    authorize([ADMIN, SUPER_ADMIN, ACTING_SUPER_ADMIN]),
    validate(createUser),
    controller.create
  );

router.route("/teamsearch/:userId").get(authorize(ADMIN), controller.search);
router.route("/sendOpt").post(authorize(), controller.sendOpt);
router.route("/confirmOtp").post(authorize(), controller.confirmOtp);
router.route("/profile").get(authorize(), controller.loggedIn);
router
  .route("/get-user-by-id/:userId")
  .get(authorize(), controller.getUsersById);
router.route("/update-user/:userId").post(authorize(), controller.updateUser);

router
  .route("/:userId")
  .get(authorize(LOGGED_USER), controller.get)
  .put(authorize(LOGGED_USER), validate(replaceUser), controller.replace)
  .patch(authorize(LOGGED_USER), validate(updateUser), controller.update)
  .delete(authorize(LOGGED_USER), controller.remove);

router
  .route("/user-super/:userId")
  .put(
    authorize([SUPER_ADMIN, ACTING_SUPER_ADMIN]),
    controller.updateUserStatus
  )
  .delete(
    authorize([SUPER_ADMIN, ACTING_SUPER_ADMIN]),
    controller.removeUserByAdmin
  ); //aaply authentication

router
  .route("/user-block/:userId")
  .put(
    authorize([SUPER_ADMIN, SUPER_EDITOR]),
    controller.updateUserActiveStatus
  ); //aaply authentication
router
  .route("/admin/search")
  .get(
    authorize([SUPER_ADMIN, SUPER_EDITOR, SUPER_VIEWER, ACTING_SUPER_ADMIN]),
    controller.searchUsersByAdmin
  );

router
  .route("/all/:userId")
  .get(
    authorize([SUPER_ADMIN, SUPER_EDITOR, SUPER_VIEWER, ACTING_SUPER_ADMIN]),
    controller.getAll
  );

router.route("/test-info").post(authorize(), async (req, res) => {
  const currentSubscription = await subscription.findOne({
    _id: mongoose.Types.ObjectId("64f86a69ab581d3977ad459e"),
  });
  const priceInfo = await stripeProducts.findOne({
    priceId: currentSubscription.stripePriceId,
  });

  return res.status(200).json({ message: "success" });
});

router.route("/convert").post(authorize(SUPER_ADMIN), (req, res) => {
  try {
    const { base64PNG } = req.body;

    potrace.trace(base64PNG, function (err, svg) {
      if (err) throw err;
      fs.writeFileSync("./output.svg", svg);
    });

    return res.status(200).json({ message: "SVG conversion successful" });
  } catch (error) {
    console.error("Error converting image:", error);
    return res
      .status(500)
      .json({ error: "An error occurred during conversion" });
  }
});

router.post(
  "/azure-user-create",
  authorize(["superadmin", "admin"]),
  controller.azureCreateUser
);

router.post("/update-iswelcome", controller.updateIsWelcome);
router.post(
  "/ssorequest",
  authorize(["superadmin", "admin"]),
  controller.SSoSyncReq
);

module.exports = router;
