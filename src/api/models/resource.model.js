const mongoose = require('mongoose')
const excludeFieldsPlugin = require('./plugins/transform')

const resourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    gcsName: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      index: true,
      required: true,
      unique: true
    },
    public: {
      type: Boolean
    },
    qr: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QR',
      index: true
    },
    identifier: {
      type: String
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    }
  },
  {
    timestamps: true
  }
)

resourceSchema.plugin(excludeFieldsPlugin)

const Resource = mongoose.model('Resource', resourceSchema)

module.exports = Resource
