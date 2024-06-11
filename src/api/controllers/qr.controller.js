const httpStatus = require("http-status");
const QR = require("../models/qr.model");
const Batch = require("../models/batch.model");
const Folder = require("../models/folder.model");
const APIError = require("../errors/api-error");
var ObjectId = require("mongodb").ObjectID;
const User = require("../models/user.model");
const ShortUniqueId = require("short-unique-id");
const shortId = new ShortUniqueId({ length: 10 });

const { currentSubscription } = require("../controllers/subscription");

const {
  isValidUrl,
  SCANSTHRESHOLDS,
  checkTrialValid,
  camelize,
} = require("../../utils/utils");

const stripeProducts = require("../models/stripeProducts.model");
const axios = require("axios");
const { Types } = require("mongoose");
const { isValidObjectId } = require("mongoose");

/**
 * Create new qr
 * @public
 */

// const freeQrTypes = ["Url", "Sms", "MakeCall"];

exports.create = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const freeQrTypes = ["Url", "Sms", "MakeCall"];
    const current = req.user;
    let maxQRLimit = 0;
    let subscriptionValid = false;
    let createdByTrialValid = false;
    let subscriptionFound;
    let enterpriseQrLimit = 10000;

    if (user?.createdBy) {
      const createdByUser = await User.findOne({
        _id: user.createdBy,
      });
      createdByTrialValid = checkTrialValid(createdByUser?.trialExpirationDate);
      subscriptionFound = await currentSubscription(createdByUser._id);
      if (subscriptionFound) {
        subscriptionValid = true;
      }
    } else {
      subscriptionFound = await currentSubscription(user.id);
      if (subscriptionFound) {
        subscriptionValid = true;
      }
    }

    console.log("called");

    const trialValid = checkTrialValid(user?.trialExpirationDate);

    const isValid = trialValid || subscriptionValid || createdByTrialValid;

    if (user?.role === "viewer") {
      return res.status(httpStatus.FORBIDDEN).json({
        message:
          "Based on your current permission you can not create QR codes.",
      });
    }

    if (!freeQrTypes.includes(req.body.qrType) && !isValid) {
      if (
        req.body.eyeBall != "eye-ball-plain-square" ||
        req.body.eyeFrame != "eye-frame-plain-square" ||
        req.body.pattern != "plain" ||
        req.body.logo ||
        !freeQrTypes.includes(req.body.qrType)
      ) {
        return res.status(httpStatus.FORBIDDEN).json({
          message: !freeQrTypes.includes(req.body.qrType)
            ? `Please upgrade your plan to use ${req.body.qrType}`
            : "Shapes not available for Starter and Lite plan",
        });
      }
    }

    if (
      (trialValid || subscriptionValid) &&
      (subscriptionFound?.planName === "STARTER" || !subscriptionFound)
      //  ||
      // subscriptionFound?.planName === "LTE"
    ) {
      if (
        req.body.eyeBall != "eye-ball-plain-square" ||
        req.body.eyeFrame != "eye-frame-plain-square" ||
        req.body.pattern != "plain"
      ) {
        return res.status(httpStatus.FORBIDDEN).json({
          message: "Shapes not available for Starter and Lite plan.",
        });
      }
    }

    // if (subscriptionFound?.planName === "ENTERPRISE") {
    // handle the dynamic QR's limit for the enterprise
    // }

    if (!freeQrTypes.includes(req.body?.qrType)) {
      switch (subscriptionFound?.planName) {
        case "STARTER":
          maxQRLimit = 10;
          break;
        case "LITE":
          maxQRLimit = 50;
          break;
        case "BUSINESS":
          maxQRLimit = 250;
          break;
        case "PROFESSIONAL":
          maxQRLimit = 500;
          break;
        case "ENTERPRISE":
          maxQRLimit = enterpriseQrLimit;
          break;
        default:
          maxQRLimit = 10;
      }

      let match = {
        qrType: { $nin: freeQrTypes },
        qrStatus: "Active",
      };
      const { qrCount } = await this.getTeamQRs(current, match);

      if (qrCount && qrCount >= maxQRLimit) {
        return res.status(httpStatus.FORBIDDEN).json({
          message: `Maximum QR code limit reached for your current plan.`,
        });
      }
    }

    let folderId = req.body.folder ? req.body.folder : "";
    if (!folderId || folderId === "General") {
      const generalFolder = await Folder.findOne({
        owner: req.user._id,
        name: "General",
      });

      if (generalFolder) {
        folderId = generalFolder._id;
      } else {
        const newFolder = new Folder({
          name: "General",
          owner: req.user._id,
        });
        const savedFolder = await newFolder.save();
        folderId = savedFolder._id;
      }
    }

    if (req.body?.bulkUpload && req.body.bulkUpload?.bulkData?.length > 0) {
      let batchName =
        req.body?.bulkUpload?.bulkName || `Batch ${shortId.rnd()}`;

      let bulkUploadData = req.body?.bulkUpload?.bulkData;
      let bulkUploadSelectedQrType =
        req.body.bulkUpload?.selectedBulkUploadQrsType;

      if (subscriptionFound) {
        const allowedPlans = ["PROFESSIONAL", "ENTERPRISE", "BUSINESS"];
        if (!allowedPlans.includes(subscriptionFound?.planName)) {
          return res.status(httpStatus.FORBIDDEN).json({
            message: "On your current plan you can not add QR Batch.",
          });
        }
      } else if (!subscriptionFound) {
        return res.status(httpStatus.FORBIDDEN).json({
          message: "On your current plan you can not add QR Batch.",
        });
      }
      const batch = new Batch({
        name: batchName,
        count: bulkUploadData.length,
        owner: req.user._id,
      });
      const saveBatch = await batch.save();

      let qrInfo = req.body;
      delete qrInfo.bulkUpload;

      for (const item of bulkUploadData) {
        const qr = new QR({
          ...qrInfo,
          ...item,
          qrName: item?.[camelize(bulkUploadSelectedQrType)]?.qrName,
          qrType: bulkUploadSelectedQrType,
          user: req.user._id,
          folder: folderId,
          shortId: shortId.rnd(),
          batchId: saveBatch._id,
        });
        const savedQR = await qr.save();
      }
      return res.status(httpStatus.CREATED).json({
        message: "Qr batch added",
      });
    } else {
      const qr = new QR({
        ...req.body,
        user: req.user._id,
        folder: folderId,
        shortId: shortId.rnd(),
      });
      const savedQR = await qr.save();
      return res.json(savedQR);
    }
  } catch (error) {
    return next(error);
  }
};

/**
 * Get QR
 * @public
 */

exports.get = async (req, res, next) => {
  try {
    const qr =
      (await QR.findOne({ shortId: req.params.qrId })) ||
      (await QR.findOne({ _id: req.params.qrId }));

    if (!qr) {
      return res.status(httpStatus.NOT_FOUND).json({
        message: "QR not found",
      });
    }

    let user;
    let allowScan = true;

    if (qr.user?.createdBy) {
      user = await User.findOne(Types.ObjectId(qr.user?.createdBy));
    } else {
      user = qr.user;
    }

    // const userScans = user?.totalScans;
    // let userId = user;

    // const foundSubscription = await currentSubscription(userId);

    // if (
    //   foundSubscription &&
    //   userScans >= SCANSTHRESHOLDS[foundSubscription?.planName]
    // ) {
    //   allowScan = false;
    // }

    // if (!foundSubscription && userScans >= 25000) {
    //   allowScan = false;
    // }

    // if (foundSubscription?.planName === "ENTERPRISE") {
    //   const priceInfo = await stripeProducts.findOne({
    //     priceId: foundSubscription.stripePriceId,
    //   });

    //   if (userScans === priceInfo?.scans) {
    //     allowScan = false;
    //   }
    // }

    if (qr.logo && isValidUrl(qr.logo)) {
      const imgResponse = await axios.get(qr.logo, {
        responseType: "arraybuffer",
      });

      if (imgResponse.status === 200) {
        const imageBuffer = Buffer.from(imgResponse.data, "binary"); // Convert arraybuffer to Buffer
        const base64Image = imageBuffer.toString("base64");
        const baseImage = `data:${imgResponse.headers["content-type"]};base64,${base64Image}`;
        qr.logoBase = baseImage;
        qr.allowScan = allowScan;
        res.status(httpStatus.OK);
        return res.json(qr);
      } else {
        res.status(imgResponse.status);
        return res.json({ error: "Failed to fetch logo" });
      }
    }

    qr.allowScan = allowScan;
    res.status(httpStatus.OK);
    return res.json(qr);
  } catch (error) {
    console.log("ERROR", error);
    return next(error);
  }
};

/**
 * Update QR
 * @public
 */

exports.update = async (req, res, next) => {
  try {
    let qr = await QR.findOne({ shortId: req.params.qrId });

    if (!qr && isValidObjectId(req.params.qrId)) {
      qr = await QR.findOne({ _id: req.params.qrId });
    }

    if (!qr) {
      throw new APIError({
        status: httpStatus.NOT_FOUND,
        message: "QR Not Found",
      });
    }

    if (qr) {
      const updatedQr = await QR.findByIdAndUpdate(qr?._id, req.body, {
        new: true,
      });
      res.status(httpStatus.OK);
      res.json(updatedQr);
    }
  } catch (error) {
    return next(error);
  }
};

exports.deleteSelected = async (req, res, next) => {
  try {
    if (!req?.body?.qrIdArr?.length)
      throw new APIError({
        status: httpStatus.NOT_FOUND,
        message: "QR Not Found",
      });
    const filter = { _id: { $in: req?.body?.qrIdArr } };
    const update = {
      ...req.body.qrStatus,
    };
    const updatedQr = await QR.updateMany(filter, update);
    res.status(httpStatus.OK);
    res.json(updatedQr);
  } catch (error) {
    return next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const qr = await QR.get(req.params.qrId);
    if (qr.user._id.toString() != req.user._id.toString()) {
      throw new APIError({
        status: httpStatus.FORBIDDEN,
        message: "QR deletion not allowed",
      });
    }
    qr.remove()
      .then(() => res.status(httpStatus.NO_CONTENT).end())
      .catch((e) => next(e));
  } catch (error) {
    return next(error);
  }
};

exports.userQR = async (req, res, next) => {
  try {
    let qrStatusFilter = {};

    if (req.query.type === "all") {
      qrStatusFilter = { $ne: "Deleted" };
    } else if (req.query.type === "deleted") {
      qrStatusFilter = "Deleted";
    }

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

    const userIds = [...users.map((user) => user._id)];

    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;

    const totalRecords = await QR.countDocuments({
      user: { $in: userIds },
      qrStatus: qrStatusFilter,
    });

    const totalPages = Math.ceil(totalRecords / limit);

    const skip = offset;
    const qrs = await QR.aggregate([
      {
        $lookup: {
          from: "analytics",
          localField: "_id",
          foreignField: "qrId",
          as: "result",
        },
      },
      {
        $match: {
          user: { $in: userIds },
          qrStatus: qrStatusFilter,
        },
      },
      {
        $addFields: {
          scanCount: { $size: "$result" },
        },
      },
      {
        $lookup: {
          from: "folders",
          let: { folderId: "$folder" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$folderId"],
                },
              },
            },
          ],
          as: "folder",
        },
      },
      {
        $unwind: "$folder",
      },
      {
        $lookup: {
          from: "labels",
          localField: "label",
          foreignField: "_id",
          as: "label",
        },
      },

      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);

    const qrsWithBase64 = await Promise.all(
      qrs.map(async (qr, index) => {
        if (qr.logo && isValidUrl(qr.logo)) {
          try {
            const imgResponse = await axios.get(qr.logo, {
              responseType: "arraybuffer",
            });

            if (imgResponse.status === 200) {
              const imageBuffer = Buffer.from(imgResponse.data, "binary");
              const base64Image = imageBuffer.toString("base64");
              const baseImage = `data:${imgResponse.headers["content-type"]};base64,${base64Image}`;
              console.log(baseImage);
              return {
                ...qr,
                logoBase: baseImage,
              };
            } else {
              return qr;
            }
          } catch (error) {
            console.error("Error fetching image:", error);
            return qr;
          }
        } else {
          return qr;
        }
      })
    );

    res.status(httpStatus.OK).json({
      qrs: qrsWithBase64,
      currentPage: Math.floor(offset / limit) + 1,
      totalPages: totalPages,
      totalRecords: totalRecords,
    });
  } catch (error) {
    next(error);
  }
};

exports.searchUserQrs = async (req, res, next) => {
  try {
    const qrTypeFilter = req.query.qrType;
    const qrNameFilter = req.query.qrName;
    const qrStatusFilter = req.query.qrStatus;
    const qrSortBy = req.query.sortBy;
    const folderId = req.query.qrFolder;
    const labelId = req.query.qrLabel;
    const notInclude =
      req.query.searchType === "all"
        ? ["Deleted"]
        : ["Active", "Paused", "Blocked"];

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

    const matchStage = {
      $match: {
        user: { $in: userIds },
      },
    };

    if (qrStatusFilter) {
      matchStage.$match.qrStatus = { $regex: qrStatusFilter, $options: "i" };
    } else {
      matchStage.$match.qrStatus = { $nin: notInclude };
    }

    if (qrTypeFilter) {
      matchStage.$match.qrType = { $regex: qrTypeFilter, $options: "i" };
    }

    if (qrNameFilter) {
      matchStage.$match.qrName = { $regex: qrNameFilter, $options: "i" };
    }

    const pipeline = [
      {
        $lookup: {
          from: "analytics",
          localField: "_id",
          foreignField: "qrId",
          as: "result",
        },
      },
      matchStage,
      {
        $addFields: {
          scanCount: { $size: "$result" },
        },
      },
      {
        $lookup: {
          from: "folders",
          let: { folderId: "$folder" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$folderId"],
                },
              },
            },
          ],
          as: "folder",
        },
      },
      {
        $unwind: "$folder",
      },
      {
        $lookup: {
          from: "labels",
          localField: "label",
          foreignField: "_id",
          as: "label",
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
    ];

    if (folderId) {
      pipeline.push({
        $match: {
          "folder._id": ObjectId(folderId),
        },
      });
    }

    if (labelId) {
      pipeline.push({
        $match: {
          "label._id": ObjectId(labelId),
        },
      });
    }

    if (qrSortBy) {
      let sortStage = {};

      if (qrSortBy === "MoreScans") {
        sortStage = { scanCount: -1 };
      } else if (qrSortBy === "LessScans") {
        sortStage = { scanCount: 1 };
      } else if (qrSortBy === "Recent") {
        sortStage = { createdAt: -1 };
      } else if (qrSortBy === "Name") {
        sortStage = { qrName: 1 };
      }

      pipeline.push({ $sort: sortStage });
    }

    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;

    const qrs = await QR.aggregate(pipeline);

    // Calculate the totalRecords and totalPages based on the filtered results
    const totalRecords = qrs.length;
    const totalPages = Math.ceil(totalRecords / limit);

    // Apply pagination using slice method
    const startIndex = offset * limit;
    const endIndex = startIndex + limit;
    const paginatedQrs = qrs.slice(startIndex, endIndex);

    const qrsWithBase64 = await Promise.all(
      paginatedQrs.map(async (qr, index) => {
        if (qr.logo && isValidUrl(qr.logo)) {
          try {
            const imgResponse = await axios.get(qr.logo, {
              responseType: "arraybuffer",
            });

            if (imgResponse.status === 200) {
              const imageBuffer = Buffer.from(imgResponse.data, "binary");
              const base64Image = imageBuffer.toString("base64");
              const baseImage = `data:${imgResponse.headers["content-type"]};base64,${base64Image}`;
              console.log(baseImage);
              return {
                ...qr,
                logoBase: baseImage,
              };
            } else {
              return qr;
            }
          } catch (error) {
            console.error("Error fetching image:", error);
            return qr;
          }
        } else {
          return qr;
        }
      })
    );

    res.status(httpStatus.OK).json({
      qrs: qrsWithBase64,
      currentPage: Math.floor(offset / limit) + 1,
      totalPages,
      totalRecords,
    });
  } catch (error) {
    return next(error);
  }
};

exports.duplicate = async (req, res, next) => {
  try {
    const sourceDocumentId = req.params.duplicateId;

    let qr = await QR.findOne({ shortId: sourceDocumentId });

    if (!qr && isValidObjectId(sourceDocumentId)) {
      qr = await QR.findOne({ _id: sourceDocumentId });
    }

    if (!qr) {
      throw new APIError({
        status: httpStatus.NOT_FOUND,
        message: "QR Not Found",
      });
    }

    const sourceDocument = await QR.findOne({
      _id: ObjectId(sourceDocumentId),
    }).lean();

    // console.log({ sourceDocument });
    if (sourceDocument) {
      const { _id, ...rest } = sourceDocument;
      const duplicatedDocument = new QR(rest);
      await duplicatedDocument.save();

      return res.status(httpStatus.OK).json({
        message: "Document Duplicated Successfully",
      });
    } else {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: "Source document not found",
      });
    }
  } catch (error) {
    console.log("error", error);
    return next(error);
  }
};

exports.createFreeQr = async (req, res, next) => {
  try {
    if (
      req.body.eyeBall != "eye-ball-plain-square" ||
      req.body.eyeFrame != "eye-frame-plain-square" ||
      req.body.pattern != "plain" ||
      req.body.logo ||
      req.body.qrFrame != "none"
    ) {
      return res.status(httpStatus.PAYMENT_REQUIRED).json({
        message: "You need to be Signed in first for premium features",
      });
    }

    // let folderId = "";

    // const newFolder = new Folder({ name: "General", owner: req.user._id });
    // const savedFolder = await newFolder.save();
    // folderId = savedFolder._id;

    const qr = new QR({ ...req.body, shortId: shortId.rnd() });

    const savedQR = await qr.save();
    res.status(httpStatus.CREATED);
    return res.json(savedQR);
  } catch (error) {
    console.log("error in Qr create", error);
    return next(error);
  }
};

exports.getTeamQRs = async (current, match) => {
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
  const qrs = await QR.find({
    user: userIds,
    ...match,
  });
  return {
    userIds,
    qrCount: qrs?.length || 0,
    qrs: qrs,
  };
};
