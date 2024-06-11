const express = require("express");
const validate = require("express-validation");
const multer = require("multer");
const upload = multer();

const controller = require("../../controllers/qr.controller");
const {
  addQR,
  getQR,
  updateQR,
  deleteQR,
  userQR,
} = require("../../validations/qr.validation");
const { authorize, sameUser } = require("../../middlewares/auth");
const { fileSave } = require("../../controllers/resource.controller");
const router = express.Router();

router.route("/").post(authorize(), validate(addQR), controller.create);
router.route("/createFreeQr").post(validate(addQR), controller.createFreeQr);

router
  .route("/:qrId")
  .get(validate(getQR), controller.get)
  .put(authorize(), validate(updateQR), controller.update)
  .delete(authorize(), validate(deleteQR), controller.delete);

router.post("/deleteselected", authorize(), controller.deleteSelected);

router.post("/duplicate/:duplicateId", authorize(), controller.duplicate);

router
  .route("/user/:userId")
  .get(authorize(), validate(userQR), sameUser, controller.userQR);

router
  .route("/user/search/:userId")
  .get(authorize(), validate(userQR), sameUser, controller.searchUserQrs);

router.route("/test").post(upload.any("files"), (req, res) => {
  fileSave(req, res);
});

module.exports = router;
