// util.js

const ObjectId = require("mongoose").Types.ObjectId;

const centsToDollar = (cents) => {
  return cents / 100;
};

const isValidUrl = (str) => {
  try {
    const parsedUrl = new URL(str);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch (error) {
    return false;
  }
};
const SUPER_ROLES = [
  "superAdmin",
  "superEditor",
  "superViewer",
  "actingSuperAdmin",
];

const EXCLUDED_SUPER_ADMIN_ROLES = [
  "superEditor",
  "superViewer",
  "actingSuperAdmin",
];

const SCANSTHRESHOLDS = {
  BUSINESS: 250000,
  PROFESSIONAL: 500000,
  LITE: 25000,
  STARTER: 75000,
};

const IsSuperRole = (role) => {
  return SUPER_ROLES.includes(role);
};

function isValidObjectId(id) {
  if (ObjectId.isValid(id)) {
    if (String(new ObjectId(id)) === id) return true;
    return false;
  }
  return false;
}

const checkTrialValid = (expirationDate) => {
  if (expirationDate) {
    const trialValid = expirationDate && new Date() <= expirationDate;
    return trialValid;
  } else {
    return false;
  }
};

function camelize(str) {
  return str
    ?.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
}
module.exports = {
  EXCLUDED_SUPER_ADMIN_ROLES,
  SUPER_ROLES,
  IsSuperRole,
  isValidUrl,
  centsToDollar,
  SCANSTHRESHOLDS,
  isValidObjectId,
  checkTrialValid,
  camelize,
};
