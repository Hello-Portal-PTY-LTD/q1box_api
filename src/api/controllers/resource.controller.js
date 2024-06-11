const httpStatus = require("http-status");
const APIError = require("../errors/api-error");
const { uploadFile, deleteBucketFiles } = require("../../storage/gcs");
const Resource = require("../models/resource.model");
const { isValidUrl } = require("../../utils/utils");
const { default: axios } = require("axios");
const { Storage } = require("@google-cloud/storage");

exports.fileSave = async (req, res, next) => {
  try {
    console.time("uploading start");
    const files = req.files; // Array of files
    const uploadPromises = [];
    for (const file of files) {
      uploadPromises.push(uploadFile(file));
    }

    const uploadResults = await Promise.all(uploadPromises);

    const savedResources = uploadResults.map((result, index) => {
      const { identifier, url, gcsName } = result;

      const resource = new Resource({
        name: files[index].originalname,
        gcsName,
        url,
        public: true,
        identifier,
      });

      return resource.save();
    });

    const savedResourcesData = await Promise.all(savedResources);

    res.json(savedResourcesData);
  } catch (error) {
    next(error);
  }
};

exports.fileDelete = async (req, res, next) => {
  try {
    const { url } = req.body;

    const resource = await Resource.findOne({ url });
    const response = await deleteFile(resource.gcsName);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

exports.getBase64 = async (req, res, next) => {
  try {
    const url = req.body.url;
    if (isValidUrl(url)) {
      const img = await axios.get(url, { responseType: "arraybuffer" });

      const imageBuffer = Buffer.from(img.data, "binary"); // Convert arraybuffer to Buffer
      const base64Image = imageBuffer.toString("base64");
      const baseImage = `data:${img.headers["content-type"]};base64,${base64Image}`;
      res.status(httpStatus.OK);
      res.json(baseImage);
    } else {
      res.status(httpStatus.OK);
      res.json(baseImage);
    }
  } catch (error) {
    return next(error);
  }
};

exports.deleteAllFiles = async (req, res, next) => {
  try {
    deleteBucketFiles(res);
  } catch (error) {
    return next(error);
  }
};
