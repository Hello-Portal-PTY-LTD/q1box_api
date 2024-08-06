const express = require("express");
const validate = require("express-validation");
const controller = require("../../controllers/folder.controller");
const {
  createFolder,
  updateFolder,
  deleteFolder,
  listFolders,
  getFolder,
} = require("../../validations/folder.validation");
const { authorize, sameUser } = require("../../middlewares/auth");

const router = express.Router();

router.route("/").post(authorize(), validate(createFolder), controller.create);

router
  .route("/:folderId")
  .get(authorize(), validate(getFolder), controller.listFolderQRs)
  .put(authorize(), validate(updateFolder), controller.update)
  .delete(authorize(), validate(deleteFolder), controller.delete);

router
  .route("/user/:userId")
  .get(authorize(), validate(listFolders), controller.listFolders);

router
  .route("/user/detail/:userId")
  .get(authorize(), validate(listFolders), controller.getFoldersWithQrs);
module.exports = router;
