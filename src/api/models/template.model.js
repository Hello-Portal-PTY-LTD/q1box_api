const { boolean } = require("joi");
const User = require("./user.model");
const { model, Schema, Types } = require("mongoose");
const StringType = {
  type: String,
};
const templateSchema = new Schema(
  {
    userId: { ref: User, type: Schema.ObjectId, index: true },
    type: { type: String, maxLength: 40 },
    qrImage: StringType,
    eyeRadius: {
      innerRadius: Array,
      outerRadius: Array,
    },
    qrStyle: StringType,
    qrFrame: StringType,
    qrFrameColor: StringType,
    qrEyeBallColor: StringType,
    qrEyeFrameColor: StringType,
    qrTextColor: StringType,
    bgColor: StringType,
    fgColor: StringType,
    logo: StringType,
    logoSize: StringType,
    eyeBall: StringType,
    eyeFrame: StringType,
    qrTemplate: StringType,
    pattern: StringType,
    aspectRatio: StringType,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const TemplateModel = model("Template", templateSchema);

module.exports = TemplateModel;
