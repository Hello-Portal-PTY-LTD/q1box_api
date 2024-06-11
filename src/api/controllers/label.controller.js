const httpStatus = require("http-status");
const Label = require("../models/label.model");
const APIError = require("../errors/api-error");
const QR = require("../models/qr.model");
const User = require("../models/user.model");

/**
 * Create new folder
 * @public
 */
exports.createLabel = async (req, res, next) => {
  try {
    if (req.body.owner !== req.user.id) {
      throw new APIError({
        status: httpStatus.UNAUTHORIZED,
        message: "Label creation for other user is not allowed",
      });
    }
    const label = new Label(req.body);
    const savedLabel = await label.save();
    res.status(httpStatus.CREATED);
    res.json(savedLabel);
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
    const updatedLabel = await Label.findOneAndUpdate(
      { _id: req.params.labelId, owner: req.user.id },
      req.body,
      {
        new: true,
      }
    );
    if (!updatedLabel) {
      throw new APIError({
        status: httpStatus.UNAUTHORIZED,
        message: "Label not found!",
      });
    }
    res.status(httpStatus.OK);
    res.json(updatedLabel);
  } catch (error) {
    next(error);
  }
};

/**
 * get labels for user
 * @public
 */
exports.listLabels = async (req, res, next) => {
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

    // Find folders owned by any of the users in userIds
    const labels = await Label.find({ owner: { $in: userIds } });

    const labelData = await Promise.all(
      labels.map(async (label) => {
        // Find the QR codes associated with the current folder
        const qrs = await QR.find({ label: label._id });

        return {
          name: label.name,
          createdAt: label.createdAt,
          qrs: qrs.length,
          id: label._id,
        };
      })
    );
    res.status(httpStatus.OK);
    res.json(labelData);
  } catch (error) {
    next(error);
  }
};

/**
 * get qrs in a label
 * @public
 */
exports.listLabelQRs = async (req, res, next) => {
  let labelId = req.params.labelId;
  try {
    const label = await Label.findById(labelId);
    const qrs = await QR.find({ label: labelId, user: req.user.id });
    res.status(httpStatus.OK);
    res.json({ label, qrs });
  } catch (error) {
    next(error);
  }
};

/**
 * get folders with qrs associated with them
 * @public
 */

exports.getLabelWithQrs = async (req, res, next) => {
  const userId = req.params.userId;
  try {
    // Find all folders belonging to the user
    const labels = await Label.find({ owner: userId });

    // Iterate over each folder and retrieve associated QR codes
    const labelData = await Promise.all(
      labels.map(async (label) => {
        // Find the QR codes associated with the current folder
        const qrs = await QR.find({ label: label._id });

        return {
          [label.name]: {
            createdAt: label.createdAt,
            qrs: qrs,
          },
        };
      })
    );

    res.status(httpStatus.OK);
    res.json(labelData);
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
    const deletedLabel = await Label.findOneAndDelete({
      _id: req.params.labelId,
      owner: req.user.id,
    });
    if (deletedLabel) {
      const pipeline = [
        { $match: { label: req.params.labelId } },
        { $set: { label: null } },
      ];
      await QR.aggregate(pipeline).exec();

      res.sendStatus(httpStatus.NO_CONTENT);
      return;
    }
    throw new APIError({
      status: httpStatus.NOT_FOUND,
      message: "Label not found!",
    });
  } catch (error) {
    next(error);
  }
};
