const httpStatus = require("http-status");
const Folder = require("../models/folder.model");
const APIError = require("../errors/api-error");
const QR = require("../models/qr.model");
const User = require("../models/user.model");

/**
 * Create new folder
 * @public
 */

exports.create = async (req, res, next) => {
  try {
    const current = await User.findById(req.user.id);
    let otherUsers = [];

    otherUsers = await User.find({
      createdBy: current.createdBy ?? current._id,
    });

    const ids = [current._id];
    otherUsers.forEach((user) => ids.push(user._id));
    const existingFolderForUser = await Folder.findOne({
      owner: { $in: ids },
      name: req.body.name,
    });

    if (existingFolderForUser) {
      throw new APIError({
        status: httpStatus.BAD_REQUEST,
        message: "A folder with the same name already exists",
      });
    }

    const folder = new Folder(req.body);
    const savedFolder = await folder.save();
    const responseObj = {
      id: savedFolder._id,
      name: savedFolder.name,
      createdAt: savedFolder.createdAt,
    };
    console.log('savedFolder', responseObj)
    res.status(httpStatus.CREATED);
    res.json(responseObj);
  } catch (error) {
    next(error);
  }
};

/**
 * Update folder
 * @public
 */
exports.update = async (req, res, next) => {
  try {
    const updatedFolder = await Folder.findOneAndUpdate(
      { _id: req.params.folderId, owner: req.user.id },
      req.body,
      {
        new: true,
      }
    );
    if (!updatedFolder) {
      throw new APIError({
        status: httpStatus.UNAUTHORIZED,
        message: "Folder not found!",
      });
    }
    res.status(httpStatus.OK);
    res.json(updatedFolder);
  } catch (error) {
    next(error);
  }
};

/**
 * get folders for user
 * @public
 */
exports.listFolders = async (req, res, next) => {
  try {
    // Find the createdBy user
    const current = await User.findById(req.params.userId);

    let users = [current];
    if (current.createdBy) {
      let tempUsers = await User.find({
        $or: [{ createdBy: current.createdBy }, { _id: current.createdBy }],
      });
      if (tempUsers && Array.isArray(tempUsers)) users.push(...tempUsers);
    } else {
      let tempUsers = await User.find({ createdBy: current._id });
      if (tempUsers && Array.isArray(tempUsers)) users.push(...tempUsers);
    }

    // Get the IDs of all users (including createdByUser)
    const userIds = [...users.map((user) => user._id)];

    const folders = await Folder.find({ owner: { $in: userIds } });

    const qrFolders = await Promise.all(
      folders.map(async (folder) => {
        const qrs = await QR.find({ folder: folder._id, qrStatus: "Active" }); // Filter QRs with status 'active'
        return {
          name: folder.name,
          createdAt: folder.createdAt,
          qrs: qrs.length,
          id: folder._id,
        };
      })
    );

    res.status(httpStatus.OK);
    res.json({
      qrFolders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * get qrs in a folder
 * @public
 */
exports.listFolderQRs = async (req, res, next) => {
  let folderId = req.params.folderId;
  try {
    const folder = await Folder.findById(folderId);
    const qrs = await QR.find({ folder: folderId });
    res.status(httpStatus.OK);
    res.json({ folder, qrs });
  } catch (error) {
    next(error);
  }
};

/**
 * get folders with qrs associated with them
 * @public
 */

exports.getFoldersWithQrs = async (req, res, next) => {
  const userId = req.params.userId;
  try {
    // Find all folders belonging to the user
    const folders = await Folder.find({ owner: userId });

    // Iterate over each folder and retrieve associated QR codes
    const folderData = await Promise.all(
      folders.map(async (folder) => {
        // Find the QR codes associated with the current folder
        const qrs = await QR.find({ folder: folder._id });

        return {
          [folder.name]: {
            createdAt: folder.createdAt,
            qrs: qrs,
          },
        };
      })
    );

    res.status(httpStatus.OK);
    res.json(folderData);
  } catch (error) {
    next(error);
  }
};

/**
 * delete folder
 * @public
 */
exports.delete = async (req, res, next) => {
  try {
    const deletedFolder = await Folder.findOneAndDelete({
      _id: req.params.folderId,
      owner: req.user.id,
    });
    if (deletedFolder) {
      const pipeline = [
        { $match: { folder: req.params.folderId } },
        { $set: { folder: null } },
      ];
      await QR.aggregate(pipeline).exec();

      res.sendStatus(httpStatus.NO_CONTENT);
      return;
    }
    throw new APIError({
      status: httpStatus.NOT_FOUND,
      message: "Folder not found!",
    });
  } catch (error) {
    next(error);
  }
};
