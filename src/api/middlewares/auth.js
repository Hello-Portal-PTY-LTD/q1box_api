const httpStatus = require("http-status");
const passport = require("passport");
const User = require("../models/user.model");
const APIError = require("../errors/api-error");
const Promise = require("bluebird");

const ADMIN = "admin";
const LOGGED_USER = "_loggedUser";
const SUPER_ADMIN = "superAdmin";
const SUPER_EDITOR = "superEditor";
const SUPER_VIEWER = "superViewer";
const ACTING_SUPER_ADMIN = "actingSuperAdmin";

const handleJWT = (req, res, next, roles) => async (err, user, info) => {
  const error = err || info;

  const logIn = Promise.promisify(req.logIn);
  const apiError = new APIError({
    message: error ? error.message : "Unauthorized",
    status: httpStatus.UNAUTHORIZED,
    stack: error ? error.stack : undefined,
  });

  try {
    if (error || !user) throw error;
    await logIn(user, { session: false });
  } catch (e) {
    return next(apiError);
  }

  if (user?.isBlocked) {
    apiError.status = httpStatus.UNAUTHORIZED;
    apiError.message = "Forbidden Exit User";
    return next(apiError);
  }
  if (user?.isDeleted) {
    apiError.status = httpStatus.UNAUTHORIZED;
    apiError.message = "Forbidden Exit User";
    return next(apiError);
  }
  if (user?.createdBy) {
    const teamHead = await User.findById(user?.createdBy);
    if (teamHead?.isBlocked) {
      apiError.status = httpStatus.UNAUTHORIZED;
      apiError.message = "Forbidden Exit User";
      return next(apiError);
    }
    if (teamHead?.isDeleted) {
      apiError.status = httpStatus.UNAUTHORIZED;
      apiError.message = "Forbidden Exit User";
      return next(apiError);
    }
  }

  if (roles === LOGGED_USER) {
    if (user.role !== "admin" && req.params.userId !== user._id.toString()) {
      apiError.status = httpStatus.FORBIDDEN;
      apiError.message = "Forbidden";
      return next(apiError);
    }
  }
  req.user = user;
  return next();
};

exports.sameUser = (req, res, next) => {
  let requestedUserId = req.params.userId;
  let loggedInUserId = req.user._id;

  if (requestedUserId.toString() !== loggedInUserId.toString()) {
    throw new APIError({
      status: httpStatus.UNAUTHORIZED,
      message: "Forbidden",
    });
  }
  return next();
};

exports.ADMIN = ADMIN;
exports.LOGGED_USER = LOGGED_USER;
exports.SUPER_ADMIN = SUPER_ADMIN;
exports.SUPER_EDITOR = SUPER_EDITOR;
exports.SUPER_VIEWER = SUPER_VIEWER;
exports.ACTING_SUPER_ADMIN = ACTING_SUPER_ADMIN;

exports.authorize =
  (roles = [User.roles]) =>
  (req, res, next) =>
    passport.authenticate(
      "jwt",
      { session: false },
      handleJWT(req, res, next, roles)
    )(req, res, next);

exports.oAuth = (service) => passport.authenticate(service, { session: false });
