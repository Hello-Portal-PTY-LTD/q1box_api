const httpStatus = require("http-status");
const QR = require("../models/qr.model");
const Analytics = require("../models/analytics.model");
const APIError = require("../errors/api-error");
const { Types } = require("mongoose");
const User = require("../models/user.model");

const generateQuery = async (req, res, next) => {
  const { userId, qrId, timePeriod, groupBy } = req.query;
  let match = {};
  if (userId) {
    const current = req.user;
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
    // Get the list of QR IDs for the user
    const userQRs = await QR.find({ user: userIds }).select("_id");
    // Map the QR IDs to an array
    const qrIds = userQRs.map((qr) => Types.ObjectId(qr._id));

    match = { $match: { qrId: { $in: qrIds } } };
  } else {
    match = { $match: { qrId: Types.ObjectId(qrId) } };
  }

  // Handle time period filter
  if (timePeriod) {
    const currentDate = new Date();
    let startDate;

    // Calculate the start date based on the time period
    switch (timePeriod) {
      case "day":
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() - 1
        );
        break;
      case "week":
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() - 7
        );
        break;
      case "month":
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - 1,
          1
        );
        break;
      case "week":
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() - 7
        );
        break;
      case "year":
        startDate = new Date(
          currentDate.getFullYear() - 1,
          currentDate.getMonth(),
          currentDate.getDate()
        );
        break;
    }

    // Add the time period filter to the match stage
    match.$match.createdAt = { $gte: startDate, $lte: currentDate };
  }

  let groupStage = {};

  if (groupBy === "device" || groupBy === "browser" || groupBy === "qrType") {
    groupStage = {
      $group: { _id: `$${groupBy}`, count: { $sum: 1 } },
    };
  } else if (groupBy === "city") {
    groupStage = {
      $group: { _id: "$location.city", count: { $sum: 1 } },
    };
  } else if (groupBy === "country") {
    groupStage = {
      $group: { _id: "$location.country", count: { $sum: 1 } },
    };
  } else {
    groupStage = { $group: { _id: null, count: { $sum: 1 } } };
  }

  req.query = [match, groupStage];

  next();
};

const generateResourceQuery = (group) => async (req, res, next) => {
  const { userId, qrId } = req.query;

  let match = {};
  if (userId) {
    const current = req.user;
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
    const userQRs = await QR.find({ user: userIds }).select("_id");
    // Map the QR IDs to an array
    const qrIds = userQRs.map((qr) => Types.ObjectId(qr._id));
    match = { $match: { qrId: { $in: qrIds } } };
  } else {
    match = { $match: { qrId: Types.ObjectId(qrId) } };
  }

  req.query = [
    { ...match },
    { $group: { _id: `$${group}`, count: { $sum: 1 } } },
  ];
  next();
};

const generateCountQuery = async (req, res, next) => {
  const { userId, qrId, timePeriod } = req.query;

  let query = {};
  if (userId) {
    // Get the list of QR IDs for the user
    const current = req.user;
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
    const userQRs = await QR.find({ user: userIds }).select("_id");
    // Map the QR IDs to an array
    const qrIds = userQRs.map((qr) => Types.ObjectId(qr._id));
    query = { qrId: { $in: qrIds } };
  } else {
    query = { qrId: Types.ObjectId(qrId) };
  }

  if (timePeriod) {
    const currentDate = new Date();
    let startDate;

    // Calculate the start date based on the time period
    if (timePeriod === "month") {
      startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      );
    } else if (timePeriod === "week") {
      startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() - 7
      );
    } else if (timePeriod === "year") {
      startDate = new Date(
        currentDate.getFullYear() - 1,
        currentDate.getMonth(),
        currentDate.getDate()
      );
    }

    query.createdAt = { $gte: startDate, $lte: currentDate };
  }
  req.query = query;
  next();
};
module.exports = { generateQuery, generateResourceQuery, generateCountQuery };
