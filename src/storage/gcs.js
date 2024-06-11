const { Storage } = require("@google-cloud/storage");
const path = require("path");

// Create a new instance of the Storage client
const storage = new Storage({
  projectId: "voltaic-syntax-389209", // Replace with your project ID
  keyFilename: path.join(__dirname, "/service-account-key.json"), // Replace with the path to your service account key file
});

// console.log('keyFilename:', `${__dirname}\\service-account-key.json`)

// Define your bucket name
const bucketName = "q1-bucket"; // Replace with your GCS bucket name

// Function to upload a file to GCS
const uploadFile = async (file) => {
  console.time("file upload");
  const bucket = storage.bucket(bucketName);
  const fileName = Date.now() + "-" + file.originalname;

  // Upload the file to the bucket
  const fileUpload = bucket.file(fileName);

  const stream = fileUpload.createWriteStream({
    metadata: {
      contentType: file.mimetype,
    },
    public: true,
  });

  return new Promise((resolve, reject) => {
    stream.on("error", reject);
    stream.on("finish", (some) => {
      console.timeEnd("file upload");
      resolve({
        identifier: `gs://${bucketName}/${fileName}`,
        url: `https://storage.googleapis.com/${bucketName}/${fileName}`,
        gcsName: fileName,
      });
    });
    stream.end(file.buffer);
  });
};

// Function to delete a file from GCS
const deleteFile = async (gcsName) => {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(gcsName);

  return new Promise((resolve, reject) => {
    file.delete((error) => {
      if (error) {
        reject(error);
      } else {
        resolve(`File ${gcsName} deleted successfully.`);
      }
    });
  });
};

// Function to generate a signed URL for accessing a file in GCS
const generateSignedUrl = async (fileName, options = {}) => {
  const file = storage.bucket(bucketName).file(fileName);

  // Generate the signed URL with optional access controls
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 60 * 60 * 1000, // URL expiration time (1 hour)
    ...options,
  });

  return url;
};

const deleteBucketFiles = async (res) => {
  const bucket = storage.bucket(bucketName);
  const files = await bucket.getFiles();

  const deletePromises = files.map((file) => {
    return file.delete();
  });

  // Wait for all objects to be deleted
  const deletedResult = await Promise.all(deletePromises);
  // return res.send({ deletedResult });

  // List objects in the bucket with a given prefix

  // const file = storage.bucket(bucketName).file(fileName);
};

module.exports = {
  uploadFile,
  deleteFile,
  generateSignedUrl,
  deleteBucketFiles,
};
