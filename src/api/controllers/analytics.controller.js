const httpStatus = require("http-status");
const QR = require("../models/qr.model");
const Analytics = require("../models/analytics.model");
const APIError = require("../errors/api-error");
const { Types } = require("mongoose");
const User = require("../models/user.model");
const Subscription = require("../models/subscription.model");
const qrModel = require("../models/qr.model");

exports.create = async (req, res, next) => {
  try {
    let qr = await QR.findOne({ shortId: req.body.qrId });

    let userId;
    if (!qr) {
      throw new APIError({
        message: "QR Not Found",
        status: httpStatus.NOT_FOUND,
      });
    }

    if (qr.user?.createdBy) {
      userId = qr.user?.createdBy;
    } else {
      userId = qr.user._id;
    }

    await User.findOneAndUpdate(
      { _id: Types.ObjectId(userId) },
      { $inc: { totalScans: 1 } },
      { returnOriginal: false }
    );

    let info = { ...req.body };
    delete info.shortId;
    info.qrId = qr.id || qr._id;

    const analytics = new Analytics({ ...info });
    // make the qr code
    const savedAnalytics = await analytics.save();
    res.status(httpStatus.CREATED);
    res.json(savedAnalytics);
  } catch (error) {
    return next(error);
  }
};

exports.getScanCountByGroup = async (req, res) => {
  try {
    const result = await Analytics.aggregate(req.query);
    res.status(httpStatus.OK);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.getScanCount = async (req, res, next) => {
  try {
    const count = await Analytics.countDocuments(req.query);
    res.status(httpStatus.OK);
    res.json(count);
  } catch (error) {
    next(error);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const result = await Analytics.aggregate(req.query);
    res.status(httpStatus.OK);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// Define a function to aggregate QR scans based on time periods
exports.qrScansByTimePeriod = async (req, res, next) => {
  const { timePeriod, userId, qrId } = req.query;
  const current = req.user;

  let match1 = {};
  if (userId) {
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
    const qrIds = userQRs.map((qr) => Types.ObjectId(qr._id));
    match1 = { qrId: { $in: qrIds } };
  } else {
    match1 = { qrId: Types.ObjectId(qrId) };
  }
  let format = "";
  const currentDate = new Date();
  let startDate;
  let match2 = {};
  switch (timePeriod) {
    case "hour":
      format = "%Y-%m-%d %H";
      startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() - 1,
        currentDate.getHours(),
        0,
        0,
        0
      );
      break;
    case "day":
      format = "%Y-%m-%d";
      startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() - 7
      );
      break;

    case "month":
      format = "%Y-%m";
      startDate = new Date(
        currentDate.getFullYear() - 1,
        currentDate.getMonth(),
        1
      );
      break;

    case "year":
      format = "%Y";
      startDate = new Date(
        currentDate.getFullYear() - 7,
        currentDate.getMonth(),
        1
      );
      break;
  }
  if (startDate) match2 = { createdAt: { $gte: startDate, $lte: currentDate } };

  let match = {
    $match: {
      $and: [match1, match2],
    },
  };
  const pipeline = [
    { ...match },
    {
      $group: {
        _id: {
          $dateToString: {
            date: "$createdAt",
            format: format,
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ];

  try {
    const result = await Analytics.aggregate(pipeline);
    res.status(httpStatus.OK);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.analyticsData = async (req, res, next) => {
  try {
    const { userId, qrId } = req.query;
    const current = req.user;

    let match = {};
    if (userId) {
      // Get the list of QR IDs for the user
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

      const qrIds = userQRs.map((qr) => Types.ObjectId(qr._id));
      match = { $match: { qrId: { $in: qrIds } } };
    } else {
      match = { $match: { qrId: Types.ObjectId(qrId) } };
    }

    const devicesResult = await Analytics.aggregate([
      { ...match },
      { $group: { _id: "$device", count: { $sum: 1 } } },
    ]);
    const locationsResult = await Analytics.aggregate([
      { ...match },
      { $group: { _id: "$location.city", count: { $sum: 1 } } },
    ]);

    const browsersResult = await Analytics.aggregate([
      { ...match },
      { $group: { _id: "$browser", count: { $sum: 1 } } },
    ]);

    // Transform the data into the desired format
    const devices = devicesResult.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    const locations = locationsResult.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    const browsers = browsersResult.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    // Create the final response object
    const responseData = {
      devices,
      locations,
      browsers,
    };

    // Return the response
    res.json(responseData);
  } catch (error) {
    return next(error);
  }
};

exports.getUserDataCounts = async (req, res, next) => {
  try {
    const duration = req.query.duration;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    let filter = {};
    switch (duration) {
      case "week":
        const currentWeekStart = new Date();
        currentWeekStart.setDate(
          currentWeekStart.getDate() - currentWeekStart.getDay()
        ); // Start of the current week (Sunday)
        currentWeekStart.setHours(0, 0, 0, 0);
        filter.createdAt = {
          $gte: currentWeekStart,
          $lte: now, // Current date
        };
        break;
      case "month":
        filter.createdAt = {
          $gte: new Date(now.getFullYear(), currentMonth - 1, 1), // Start of the current month
          $lte: now, // Current date
        };
        break;
      case "year":
        filter.createdAt = {
          $gte: new Date(now.getFullYear(), 0, 1), // Start of the current year
          $lte: now, // Current date
        };
        break;
      default:
        // If the duration is not specified or invalid, return an empty filter
        return {};
    }

    const aggregationPipeline = [
      {
        $match: filter,
      },
      {
        $group: {
          _id: "$planName",
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
      {
        $project: {
          _id: 0,
          planName: "$_id",
          count: "$count",
        },
      },
    ];
    const qrPipeline = [
      {
        $match: filter,
      },
      {
        $group: {
          _id: "$qrType",
          QRcount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          QRName: "$_id",
          QRCounts: "$QRcount",
        },
      },
    ];
    const qrUserPipeline = [
      {
        $match: filter,
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $group: {
          _id: "$user.firstName",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          QRUser: "$_id",
          count: "$count",
        },
      },
    ];
    const scanQRPipeline = [
      {
        $match: filter,
      },
      {
        $lookup: {
          from: "qrs",
          localField: "qrId",
          foreignField: "_id",
          as: "qr",
        },
      },
      {
        $unwind: "$qr",
      },
      {
        $group: {
          _id: "$qr.qrType",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          scanQR: "$_id",
          count: "$count",
        },
      },
    ];
    const scanUserPipeline = [
      {
        $match: filter,
      },
      {
        $lookup: {
          from: "qrs",
          localField: "qrId",
          foreignField: "_id",
          as: "qr",
        },
      },
      {
        $unwind: "$qr",
      },
      {
        $lookup: {
          from: "users", // Assuming the collection name for User is "users"
          localField: "qr.user",
          foreignField: "_id",
          as: "qr.user",
        },
      },
      {
        $unwind: "$qr.user",
      },
      {
        $group: {
          _id: "$qr.user.firstName",
          scanCount: { $sum: 1 },
        },
      },
    ];

    const countryPipeline = [
      {
        $match: filter,
      },
      {
        $group: {
          _id: "$country",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          country: "$_id",
          count: "$count",
        },
      },
    ];
    const industryPipeline = [
      {
        $match: filter,
      },
      {
        $group: {
          _id: "$industry",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          industry: "$_id",
          count: "$count",
        },
      },
    ];
    const cityPipeline = [
      {
        $match: filter,
      },
      {
        $group: {
          _id: "$city",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          city: "$_id",
          count: "$count",
        },
      },
    ];

    const [
      planTotalCount,
      subscriptionData,
      QRcount,
      scanQR,
      scanUser,
      QRResult,
      QRUser,
      countryData,
      industryData,
      cityData,
    ] = await Promise.all([
      Subscription.countDocuments(filter),
      Subscription.aggregate(aggregationPipeline),
      qrModel.countDocuments(filter),
      Analytics.aggregate(scanQRPipeline),
      Analytics.aggregate(scanUserPipeline),
      qrModel.aggregate(qrPipeline),
      qrModel.aggregate(qrUserPipeline),
      User.aggregate(countryPipeline),
      User.aggregate(industryPipeline),
      User.aggregate(cityPipeline),
    ]);
    filter.role = { $nin: ["superAdmin"] };
    const totalUser = await User.countDocuments({
      ...filter,
      role: { $nin: ["superAdmin"] },
    });
    const subUser = await User.countDocuments({
      ...filter,
      role: { $nin: ["superAdmin", "admin"] },
    });

    const adminUsers = await User.countDocuments({
      ...filter,
      role: "admin",
    });

    const result = {
      subscriptionCounts: subscriptionData,
      QRCountsByName: QRResult,
      QRUser: QRUser,
      scanUser: scanUser,
      scanQR: scanQR,
      countryCounts: countryData,
      cityCounts: cityData,
      industryCounts: industryData,
      subscriptionTotalCounts: planTotalCount,
      userTotalCount: totalUser,
      subUserTotalCount: subUser,
      adminUsers: adminUsers,
      QRcount: QRcount,
    };
    res.json(result);
  } catch (err) {
    console.log("Error in fetching data", err);
    return next(err);
  }
};
