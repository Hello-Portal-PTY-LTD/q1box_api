const express = require("express");
const validate = require("express-validation");
const multer = require("multer");

const controller = require("../../controllers/resource.controller");

const { authorize } = require("../../middlewares/auth");

const router = express.Router();
const upload = multer();

router
  .route("/")
  .post(upload.array("files"), controller.fileSave)
  .delete(controller.fileDelete);

router.route("/getbase64").post(controller.getBase64);
router.route("/delete").post(controller.deleteAllFiles);

module.exports = router;
