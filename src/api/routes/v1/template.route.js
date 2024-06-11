const express = require("express");
const controller = require("../../controllers/template.controller");
const { authorize } = require("../../middlewares/auth");

const router = express.Router();
router.route("/").post(authorize(), controller.create);
router.route("/delete/:id").post(authorize(), controller.delete);

router.route("/").get(authorize(), controller.getAllTemplates);

module.exports = router;
