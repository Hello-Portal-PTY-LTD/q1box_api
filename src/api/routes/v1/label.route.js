const express = require("express");
const validate = require("express-validation");
const controller = require("../../controllers/label.controller");
const {
  createLabel,

  getLabel,
  updateLabel,
  deleteLabel,
  listLabels,
} = require("../../validations/label.validation");
const { authorize, sameUser } = require("../../middlewares/auth");

const router = express.Router();

router
  .route("/")
  .post(authorize(), validate(createLabel), controller.createLabel);

router
  .route("/:labelId")
  .get(authorize(), validate(getLabel), controller.listLabelQRs)
  .patch(authorize(), validate(updateLabel), controller.update)
  .delete(authorize(), validate(deleteLabel), controller.delete);

router
  .route("/user/:userId")
  .get(authorize(), validate(listLabels), controller.listLabels);

router
  .route("/user/detail/:userId")
  .get(authorize(), validate(listLabels), controller.getLabelWithQrs);
module.exports = router;
