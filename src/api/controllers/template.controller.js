const httpStatus = require("http-status");
const TemplateModel = require("../models/template.model");
const APIError = require("../errors/api-error");
const QR = require("../models/qr.model");
const User = require("../models/user.model");

/**
 * Create new folder
 * @public
 */
exports.create = async (req, res, next) => {
  try {
    const UserId = req.user.id || req.user._id;
    const data = {
      userId: UserId,
      ...req.body,
    };
    const newTemplate = new TemplateModel(data);
    await newTemplate.save();
    res.status(httpStatus.CREATED);
    res.json(newTemplate);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.delete = async (req, res, next) => {
  try {
    const templateId = req.params.id;

    // const temp = await TemplateModel.findByIdAndDelete(templateId);
    const temp = await TemplateModel.findByIdAndUpdate(templateId, {
      isDeleted: true,
    });

    if (temp != null) {
      return res.status(200).json({ temp });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllTemplates = async (req, res, next) => {
  try {
    const current = await User.findById(req.user._id);

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

    const userIds = [...users.map((user) => user._id)];
    const totalRecords = await TemplateModel.find({
      userId: { $in: userIds },
      isDeleted: false,
    });
    res.status(200).json(totalRecords);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
