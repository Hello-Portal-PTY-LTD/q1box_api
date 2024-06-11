const { model, Schema, Types } = require("mongoose");
const User = require("./user.model");
const APIError = require("../errors/api-error");
const httpStatus = require("http-status");
const paginationPlugin = require("./plugins/paginate");
const excludeFieldsPlugin = require("./plugins/transform");
const Folder = require("./folder.model");
const Label = require("./label.model");
const Batch = require("./batch.model");

const StringType = {
  type: String,
};

const ArrayType_plain = {
  type: [],
};
const BooleanType = {
  type: Boolean,
};

const ArrayType = {
  type: [
    {
      name: StringType,
      url: StringType,
      type: StringType,
    },
  ],
};

const DateType = {
  type: Date,
};

const NumberType = {
  type: Number,
};

const businessCardSchema = new Schema({
  firstName: StringType,
  lastName: StringType,
  email: StringType,
  workPhone: StringType,
  mobilePhone: StringType,
  companyName: StringType,
  jobTitle: StringType,
  street: StringType,
  city: StringType,
  zipcode: StringType,
  website: StringType,
  country: StringType,
  state: StringType,
  summary: StringType,
});

const smsSchema = new Schema({
  message: StringType,
  phone: StringType,
});

const couponSchema = new Schema({
  buttonLink: StringType,
  buttonText: StringType,
  couponDetails: StringType,
  couponNo: StringType,
  salePercentage: StringType,
  couponTime: {
    hours: NumberType,
    minutes: NumberType,
    seconds: NumberType,
  },
  preview: {
    bgColor: StringType,
    buttonColor: StringType,
    textColor: StringType,
    coverImage: StringType,
  },
});

const advanceLinksSchema = new Schema({
  preview: {
    bgColor: StringType,
    fontFamily: StringType,
    iconsColor: StringType,
    textColor: StringType,
    coverImage: StringType,
    profileImage: StringType,
    name: StringType,
  },

  links: ArrayType,
});

const appDownloadSchema = new Schema({
  googlePlayUrl: StringType,
  appStoreUrl: StringType,
});

const urlSchema = new Schema({
  url: StringType,
});
const landingPageSchema = new Schema({
  url: StringType,
  url2: StringType,
  url3: StringType,
});

const menuSchema = new Schema({
  shopName: StringType,
  description: StringType,
  menuName: StringType,
  storeLink: StringType,
  buttonName: StringType,
  products: [
    {
      name: StringType,
      price: NumberType,
      image: StringType,
      bgColor: StringType,
      textColor: StringType,
    },
  ],
  preview: {
    bgColor: StringType,
    borderColor: StringType,
    textColor: StringType,
    coverImage: StringType,
    profileImage: StringType,
    buttonColor: StringType,
  },
});

const locationSchema = new Schema({
  mapUrl: StringType,
  placeName: StringType,
  position: {
    lat: NumberType,
    lng: NumberType,
  },
});

const SocialSchema = new Schema({
  links: [
    {
      name: StringType,
      url: StringType,
      type: StringType,
    },
  ],
  preview: {
    bgColor: StringType,
    textColor: StringType,
    coverImage: StringType,
    profileImage: StringType,
    profileName: StringType,
    summary: StringType,
  },
});

const uploadImageSchema = new Schema({
  files: ArrayType_plain,
  galleryName: StringType,
  backgroundColor: StringType,
});

const VideoSchmea = new Schema({
  videoTitle: StringType,
  videoUrl: StringType,
  description: StringType,
  preview: {
    backGroundColor: StringType,
    buttonColor: StringType,
    textColor: StringType,
  },
});

const showTextSchema = new Schema({
  text: StringType,
});

const sendEmailSchema = new Schema({
  email: StringType,
  message: StringType,
  subject: StringType,
});

const makeCallSchema = new Schema({
  phone: StringType,
});

const qrSchema = new Schema(
  {
    user: { ref: User, type: Schema.ObjectId, index: true },
    folder: {
      ref: Folder,
      type: Schema.ObjectId,
      index: true,
      // default: "General",
    },
    label: {
      ref: Label,
      type: Schema.ObjectId,
      index: true,
      default: null,
    },
    qrStatus: {
      type: String,
      default: "Active",
    },
    qrType: {
      type: String,
    },
    eyeRadius: {
      innerRadius: Array,
      outerRadius: Array,
    },
    eyeBall: StringType,
    eyeFrame: StringType,
    pattern: StringType,
    allowScan: BooleanType,
    bgColor: StringType,
    fgColor: StringType,
    qrFrame: StringType,
    qrTemplate: StringType,
    file: StringType,
    phone: StringType,
    qrName: StringType,
    qrEyeBallColor: StringType,
    qrEyeFrameColor: StringType,
    qrQuality: StringType,
    qrErrorLevel: StringType,
    qrFrameButtonText: StringType,
    shortId: StringType,
    qrStyle: StringType,
    logo: StringType,
    logoSize: StringType,
    qrDownloadOption: StringType,
    message: StringType,
    text: StringType,
    files: ArrayType,
    qrImage: StringType,
    qrTextColor: StringType,
    qrFrameColor: StringType,
    updateAndTrack: BooleanType,
    businessCard: businessCardSchema,
    advanceLinks: advanceLinksSchema,
    appDownload: appDownloadSchema,
    coupon: couponSchema,
    location: locationSchema,
    social: SocialSchema,
    video: VideoSchmea,
    showText: showTextSchema,
    url: urlSchema,
    sendEmail: sendEmailSchema,
    forms: urlSchema,
    sms: smsSchema,
    calendar: urlSchema,
    makeCall: makeCallSchema,
    landingPage: landingPageSchema,
    menu: menuSchema,
    reviewCollector: urlSchema,
    uploadImage: uploadImageSchema,
    downloadPdf: urlSchema,
    logoBase: StringType,
    batchId: { ref: Batch, type: Schema.ObjectId, index: true },
    shortId: StringType,
    aspectRatio: StringType,
  },
  { timestamps: true }
);

qrSchema.statics = {
  /**
   * Get user
   *
   * @param {ObjectId} id - The objectId of user.
   * @returns {Promise<User, APIError>}
   */
  async get(id) {
    let qr;

    qr = await this.findById(id).populate("user").exec();
    if (qr) {
      return qr;
    }

    throw new APIError({
      message: "QR does not exist",
      status: httpStatus.NOT_FOUND,
    });
  },
};

qrSchema.method({
  transform() {
    const transformed = {};
    const fields = [
      "user",
      "qrType",
      "eyeBall",
      "eyeFrame",
      "pattern",
      "bgColor",
      "fgColor",
      "qrFrame",
      "qrTemplate",
      "file",
      "phone",
      "qrEyeBallColor",
      "qrEyeFrameColor",
      "message",
      "text",
      "files",
      "qrTextColor",
      "qrFrameColor",
      "updateAndTrack",
      "businessCard",
      "advanceLinks",
      "appDownload",
      "coupon",
      "location",
      "product",
      "social",
      "video",
    ];

    fields.forEach((field) => {
      if (this[field] !== null && this[field] !== undefined)
        transformed[field] = this[field];
    });

    return transformed;
  },
});

qrSchema.plugin(paginationPlugin);
qrSchema.plugin(excludeFieldsPlugin);

module.exports = model("QR", qrSchema);
