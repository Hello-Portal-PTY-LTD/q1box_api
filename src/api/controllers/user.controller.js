const httpStatus = require("http-status");
const { omit } = require("lodash");
const User = require("../models/user.model");
const emailProvider = require("../services/emails/emailProvider");
const subscription = require("../models/subscription.model");
const { env } = require("../../config/vars");
const bcrypt = require("bcryptjs");
const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");
// const { azureInviteSent } = require("../utils/");
const {
  IsSuperRole,
  SUPER_ROLES,
  EXCLUDED_SUPER_ADMIN_ROLES,
} = require("../../utils/utils");
const mongoose = require("mongoose");
const stripeProducts = require("../models/stripeProducts.model");
const {
  currentSubscription,
  createSubscriptionPlan,
} = require("./subscription");
/**
 * Load user and append to req.
 * @public
 */
exports.load = async (req, res, next, id) => {
  try {
    const user = await User.get(id);
    req.locals = { user };
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Get user
 * @public
 */
exports.get = (req, res) => res.json(req.locals.user);

/**
 * Get logged in user info
 * @public
 */
exports.loggedIn = (req, res) => res.json(req.user);

/**
 * Create new user
 * @public
 */
exports.create = async (req, res, next) => {
  console.log(
    "========================== CreateUser ==============================="
  );
  try {
    const totalTeamCount = await User.countDocuments({
      createdBy: req.user.id,
    });

    const foundSubscription = await currentSubscription(req.user.id);

    if (req.user.role !== "superAdmin") {
      if (
        (totalTeamCount === 1 && foundSubscription?.planName === "BUSINESS") ||
        (totalTeamCount === 4 && foundSubscription?.planName === "PROFESSIONAL")
      ) {
        return res
          .status(400)
          .json({ message: "On Current Plan you can't add more users." });
      }
      if (
        foundSubscription?.planName === "LITE" ||
        foundSubscription?.planName === "STARTER"
      ) {
        return res
          .status(400)
          .json({ message: "On Current Plan you can't add more users." });
      }

      if (foundSubscription?.planName === "ENTERPRISE") {
        const priceInfo = await stripeProducts.findOne({
          priceId: foundSubscription.stripePriceId,
        });

        if (totalTeamCount === priceInfo?.users) {
          return res
            .status(400)
            .json({ message: "On Current Plan you can't add more users." });
        }
      }
    }
    const randomPassword = Math.random().toString(36).slice(-8);
    const user = new User({
      ...req.body,
      password: randomPassword,
      isVerified: true,
    });
    const savedUser = await user.save();
    if (savedUser) {
      emailProvider.inviteUser(savedUser, randomPassword);
    }

    const populatedUser = await User.findById(savedUser._id)
      .populate("createdBy", "firstName lastName role _id")
      .exec();

    res.status(httpStatus.CREATED);
    res.json(populatedUser);
  } catch (error) {
    next(User.checkDuplicateEmail(error));
  }
};
exports.searchTeam = async (req, res, next) => {
  try {
    res.json(req.query.searchTerm);
  } catch (error) {
    next(User.checkDuplicateEmail(error));
  }
};

/**
 * Replace existing user
 * @public
 */
exports.replace = async (req, res, next) => {
  try {
    const { user } = req.locals;
    const newUser = new User(req.body);
    const ommitRole = user.role !== "admin" ? "role" : "";
    const newUserObject = omit(newUser.toObject(), "_id", ommitRole);

    await user.updateOne(newUserObject, { override: true, upsert: true });
    const savedUser = await User.findById(user._id);

    res.json(savedUser);
  } catch (error) {
    next(User.checkDuplicateEmail(error));
  }
};

/**
 * Update existing user
 * @public
 */
exports.update = async (req, res, next) => {
  try {
    const updatedUser = req.body;

    const userId = await User.findById(req.user.id); // Replace 'userId' with the actual user ID

    if (!userId) {
      return res.status(404).json({ message: "User not found" });
    }

    const savedUser = await User.findByIdAndUpdate(
      userId,
      { ...updatedUser },
      { new: true }
    );

    res.json(savedUser);
  } catch (error) {
    if (error.code === 11000) {
      return next(new Error("Duplicate email address"));
    }
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const status = req.body.status;
    const user = await User.findById(userId);
    user.isDeleted = status;
    const newUser = await user.save();
    return res.json({
      user: newUser,
      msg: status ? "Temprary Deletd sucessfully!" : "revoke sucessfully!",
    });
  } catch (error) {
    return next(error);
  }
};
exports.updateUserActiveStatus = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const status = req.body.status;
    const user = await User.findById(userId);
    user.isBlocked = status;
    const newUser = await user.save();
    return res.json({
      user: newUser,
      msg: status ? "user blocked sucessfully!" : "user unBlocked sucessfully!",
    });
  } catch (error) {
    return next(error);
  }
};
exports.removeUserByAdmin = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await User.findByIdAndDelete(userId);
    return res.json({ msg: "Permanent deleted sucessfully!" });
  } catch (error) {
    return next(error);
  }
};
exports.searchUsersByAdmin = async (req, res) => {
  try {
    const { searchKeywords, subscriptionType, blocked, page } = req.query;
    const resultsPerPage = 10;
    const currentPage = parseInt(page) || 1;

    const query = {};
    if (searchKeywords) {
      const keywordRegExp = new RegExp(searchKeywords, "i");
      query.$or = [{ firstName: keywordRegExp }, { lastName: keywordRegExp }];
    }

    if (subscriptionType) {
      const subscriptions = await subscription
        .find({ planName: subscriptionType })
        .lean();
      const subscriptionIds = subscriptions.map(
        (subscription) => subscription._id
      );

      query.subscriptionId = { $in: subscriptionIds };
    }

    if (blocked !== undefined && blocked) {
      query.isBlocked = blocked === "true" ? true : false;
    }

    const totalResults = await User.countDocuments(query);
    const totalPages = Math.ceil(totalResults / resultsPerPage);
    const skip = (currentPage - 1) * resultsPerPage;

    const users = await User.find(query)
      .populate("subscriptionId")
      .skip(skip)
      .limit(resultsPerPage)
      .lean();

    res.json({
      users: users,
      pagination: {
        totalResults: totalResults,
        totalPages: totalPages,
        currentPage: currentPage,
        resultsPerPage: resultsPerPage,
      },
      msg: "Successfully fetched data",
    });
  } catch (error) {
    console.log("ERROR:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
exports.getUsersById = async (req, res) => {
  try {
    const { userId } = req.params;

    const findUser = await User.findById(userId);

    const clientId = process.env.AZURE_AD_APP_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_APP_CLIENT_SECRET;
    const tenantId = process.env.AZURE_AD_TENANT_ID;
    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret
    );
    if (findUser.hasAzureAD) {
      const graphClient = Client.initWithMiddleware({
        authProvider: {
          getAccessToken: async () => {
            const token = await credential.getToken(
              "https://graph.microsoft.com/.default"
            );
            return token.token;
          },
        },
      });
      const userResponse = await graphClient
        .api("/users")
        .filter(
          `(otherMails/any(c:c eq '${findUser.email}') or mail eq '${findUser.email}') or userPrincipalName eq '${findUser.email}'`
        )
        .get();

      if (userResponse.value.length <= 0) {
        await User.findByIdAndDelete(userId);
        return res.status(404).json({ status: 404, data: "User not found" });
      }
    }

    const user = await User.findById(userId).populate("subscriptionId").lean();
    res.json({
      user: user,
      msg: user ? "Successfully fetched data" : "No data found",
    });
  } catch (error) {
    console.log("ERROR:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Get user team list
 * @public
 */
exports.list = async (req, res, next) => {
  try {
    const role = req?.user?.role;
    const { isDeleted, offset, limit } = req.query;
    const createdBy = req.user.id;
    let query = {};
    if (isDeleted !== undefined) {
      query.isDeleted = isDeleted === "true";
    } else {
      query.isDeleted = false;
    }

    let options = {
      sort: { createdAt: -1 }, // Sort by createdAt in descending order
      page: Math.ceil((parseInt(offset) || 0) / (parseInt(limit) || 10)) + 1, // Calculate the page
      limit: parseInt(limit) || 10, // Items per page
    };

    if (IsSuperRole(role)) {
      query.$and = [
        { role: { $in: EXCLUDED_SUPER_ADMIN_ROLES } },
        { _id: { $nin: req?.user?._id } },
      ];
    } else {
      query.createdBy = createdBy;
    }

    const result = await User.paginate(query, options);

    return res.json({
      users: result.docs,
      pagination: {
        currentPage: result.page,
        totalRecords: result.totalDocs,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.search = async (req, res, next) => {
  try {
    const createdBy = req.params.userId;
    const searchTerm = req.query.searchTerm;
    const { page, limit } = req.query; // Add pagination query parameters

    const query = {
      $and: [
        { createdBy: createdBy },
        {
          $or: [
            { email: { $regex: searchTerm, $options: "i" } },
            {
              $or: [
                { firstName: { $regex: searchTerm, $options: "i" } },
                { lastName: { $regex: searchTerm, $options: "i" } },
                {
                  $and: [
                    { firstName: { $regex: searchTerm, $options: "i" } },
                    { lastName: { $regex: searchTerm, $options: "i" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    let options = {
      sort: { createdAt: -1 }, // Sort by createdAt in descending order
      page: parseInt(page) || 1, // Page number
      limit: parseInt(limit) || 10, // Items per page
    };

    const result = await User.paginate(query, options);

    return res.json({
      users: result.docs,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalRecords: result.totalDocs,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.sendOpt = async (req, res, next) => {
  try {
    const newEmail = req.body.email;
    const emailExists = await User.exists({ email: newEmail });
    if (emailExists) {
      return res.status(404).json({ message: "Email already exists" });
    }

    const id = req.user._id;
    const otp = Math.floor(1000 + Math.random() * 9000);
    const otpExpiration = Date.now() + 30 * 60 * 1000;
    const user = await User.findById(id);
    user.otp = otp;
    user.otpExpiration = otpExpiration;
    await user.save();

    // Assuming 'emailProvider' is a valid provider with an 'updateEmailOPT' function
    emailProvider.updateEmailOPT(newEmail, otp);

    return res
      .status(httpStatus.CREATED)
      .json({ message: "Verification email sent successfully" });
  } catch (error) {
    console.log("error in catch => ", error);
    return res.status(400).json({ message: "Could not request update" });
  }
};

exports.confirmOtp = async (req, res, next) => {
  try {
    const id = req.user._id;
    const otp = req.body.otp;
    const userOtp = req.user.otp;
    const user = req.user;

    const otpExpirationTime = new Date(user.otpExpiration);
    const currentTime = new Date();

    if (userOtp === otp && currentTime < otpExpirationTime) {
      req.body.user.isVerified = true;
      const updatedUser = await User.findByIdAndUpdate(id, req.body.user, {
        new: true,
      });
      return res.status(httpStatus.CREATED).json({
        user: updatedUser,
        message: "User Updated Successfully",
      });
    } else {
      return res.status(400).json({ message: "Invalid or Expired OTP" });
    }
  } catch (error) {
    return res.status(400).json({ message: "Could not request Update" });
  }
};

/**
 * Delete user
 * @public
 */
exports.remove = (req, res, next) => {
  const { user } = req.locals;

  user
    .remove()
    .then(() => res.status(httpStatus.NO_CONTENT).end())
    .catch((e) => next(e));
};

exports.updateUser = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    let info = req.body;

    if (req.body?.password) {
      const rounds = env === "test" ? 1 : 10;

      const hash = await bcrypt.hash(req.body.password, rounds);
      const password = hash;

      console.log("password: ", hash);
      info = { ...info, password };
    }

    let updatedUser = await User.findByIdAndUpdate(userId, info, {
      new: true,
    });
    return res.status(200).json({ user: updatedUser });
  } catch (error) {
    next(User.checkDuplicateEmail(error));
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const searchTerm = req.query.search;
    const planName = req.query.plan;
    const userType = req.query.users;

    const isBlocked =
      req.query.blocked === "true"
        ? true
        : req.query.blocked === "false"
        ? false
        : "all";

    const matchStage = {
      isDeleted: false,
      role: userType,
    };
    matchStage._id = { $ne: req.user.id };

    const offset = parseInt(req.query.offset) || 0;
    const pageSize = 10;

    if (searchTerm) {
      matchStage.$or = [
        { firstName: { $regex: searchTerm, $options: "i" } },
        { lastName: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const pipeline = [{ $match: matchStage }];
    if (isBlocked !== "all") {
      pipeline.push({
        $match: {
          isBlocked: isBlocked,
        },
      });
    }

    pipeline.push({
      $project: {
        firstName: 1,
        lastName: 1,
        subscriptionId: 1,
        email: 1,
        id: 1,
        isBlocked: 1,
        subscriptionPausedByAdmin: 1,
      },
    });

    if (planName) {
      if (planName === "FREE") {
        pipeline.push(
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "userId",
              as: "matchingSubscriptions",
            },
          },
          {
            $match: {
              matchingSubscriptions: { $eq: [] }, // Only include users without matching subscriptions
            },
          },
          {
            $unset: "matchingSubscriptions",
          }
        );
      } else {
        pipeline.push(
          {
            $lookup: {
              from: "subscriptions",
              let: { userId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$userId", "$$userId"] },
                    planName: planName,
                  },
                },
                {
                  $project: {
                    planName: 1,
                    subscriptionId: 1,
                  },
                },
              ],
              as: "matchingSubscriptions",
            },
          },
          {
            $match: {
              matchingSubscriptions: { $ne: [] },
            },
          },
          {
            $addFields: {
              subscription: { $arrayElemAt: ["$matchingSubscriptions", 0] },
            },
          },
          {
            $project: {
              matchingSubscriptions: 0,
              subscriptionId: 0,
            },
          }
        );
      }
    } else {
      pipeline.push(
        {
          $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "userId",
            as: "matchingSubscriptions",
          },
        },
        {
          $unwind: {
            path: "$matchingSubscriptions",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            subscription: {
              _id: "$matchingSubscriptions._id",
              planName: "$matchingSubscriptions.planName",
              subscriptionId: "$matchingSubscriptions.subscriptionId",
            },
          },
        },
        {
          $project: {
            matchingSubscriptions: 0,
            subscriptionId: 0,
          },
        }
      );
    }

    const usersCountPipeline = [...pipeline]; // Create a copy of the pipeline for counting documents
    usersCountPipeline.push({ $count: "totalUsers" });
    pipeline.push({ $skip: offset }, { $limit: pageSize });

    const [totalCountResult] = await User.aggregate(usersCountPipeline);
    const totalUsers = totalCountResult ? totalCountResult.totalUsers : 0;

    const totalPages = Math.ceil(totalUsers / pageSize);

    const users = await User.aggregate(pipeline);
    res.status(200).json({
      totalRecords: totalCountResult?.totalUsers || 0,
      users,
      currentPage: Math.floor(offset / pageSize) + 1, // Calculate the current page
      totalPages,
    });
  } catch (error) {
    console.log("Error in retrieving user data", error);
    return next(error);
  }
};
module.exports.azureCreateUser = async (req, res) => {
  const { email, fullName, azureSSOEnables } = req.body;

  try {
    const subScription = await subscription.findOne({
      userId: req.user._id,
      cancelDate: { $exists: false },
      paymentStatus: { $eq: "SUCCESS" },
    });

    if (subScription?.planName !== "PROFESSIONAL")
      return res
        .status(404)
        .json({ status: 404, message: "You are not a premium user" });
    // Azure AD application (client) credentials
    const clientId = process.env.AZURE_AD_APP_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_APP_CLIENT_SECRET;
    const tenantId = process.env.AZURE_AD_TENANT_ID;
    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret
    );

    const graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken(
            "https://graph.microsoft.com/.default"
          );
          return token.token;
        },
      },
    });

    const userResponse = await graphClient
      .api("/users")
      .filter(
        `(otherMails/any(c:c eq '${email}') or mail eq '${email}') or userPrincipalName eq '${email}'`
      )
      .get();

    // Define the invitation data
    // const inviteData = {
    //   invitedUserEmailAddress: email, // Email of the user to invite
    //   inviteRedirectUrl: process.env.QR_APP, // URL where the invited user will be redirected after accepting the invitation
    //   invitedUserDisplayName: fullName, // Display name for the invited user
    //   sendInvitationMessage: true, // Whether to send an invitation message to the user
    // };

    const user = await User.findOne({ email });

    if (userResponse?.value?.length) {
      user.azureSSOEnables = azureSSOEnables;
      user.hasAzureAD = true;
      await user.save();
      return res.status(200).json({
        status: 200,
        data: azureSSOEnables ? "SSO is Enabled" : "SSO is Disabled",
      });
    } else {
      return res.status(404).json({
        status: 404,
        message:
          "User not found in azure AD please Add user from your azure to our azure",
      });
    }
  } catch (e) {
    console.log("ERROR: ", e.message);
    return res.status(400).json({ status: 400, data: e.message });
  }
};

module.exports.updateIsWelcome = async (req, res) => {
  try {
    const id = req.body.id;

    await User.findByIdAndUpdate({ _id: id }, { isWelcome: false });
    res.status(200).json({ message: "updated" });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ message: "Could not request Update" });
  }

  //  return res.status(200).json({ status: 200, data: response });
};

module.exports.SSoSyncReq = async (req, res) => {
  try {
    const clientId = process.env.AZURE_AD_APP_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_APP_CLIENT_SECRET;
    const tenantId = process.env.AZURE_AD_TENANT_ID;
    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret
    );

    const graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken(
            "https://graph.microsoft.com/.default"
          );
          return token.token;
        },
      },
    });

    const requestBody = {
      tenantId: req?.body?.tenantId,
    };

    const addCrossTenant = await graphClient
      .api("/policies/crossTenantAccessPolicy/partners")
      .post(requestBody);

    if (addCrossTenant) {
      let user = await User.findById(req?.user?.id);

      if (user?.azureSyncStatus) {
        await graphClient
          .api(
            `/policies/crossTenantAccessPolicy/partners/${req?.body?.tenantId}/identitySynchronization`
          )
          .patch({
            userSyncInbound: {
              isSyncAllowed: true,
            },
          });
      } else {
        await graphClient
          .api(
            `/policies/crossTenantAccessPolicy/partners/${req?.body?.tenantId}/identitySynchronization`
          )
          .put({
            userSyncInbound: {
              isSyncAllowed: true,
            },
          });
      }
      const updateRequestBody = {
        inboundTrust: {
          isCompliantDeviceAccepted: true,
          isHybridAzureADJoinedDeviceAccepted: true,
          isMfaAccepted: true,
        },
        automaticUserConsentSettings: {
          inboundAllowed: true,
        },
      };
      await graphClient
        .api(
          `/policies/crossTenantAccessPolicy/partners/${req?.body?.tenantId}`
        )
        .patch(updateRequestBody);
    }

    await User.findByIdAndUpdate(req?.user?.id, {
      azureSyncStatus: true,
      azureSyncTenantId: req?.body?.tenantId,
    });
    return res.status(200).json({
      status: 200,
      data: addCrossTenant,
    });
  } catch (e) {
    console.log("ERROR:", e);
    return res.status(400).json({ status: 400, data: e.message });
  }
};
