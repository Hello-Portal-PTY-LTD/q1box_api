const mongoose = require('mongoose')
const excludeFieldsPlugin = require('./plugins/transform')

const folderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
)

const Folder = mongoose.model('Folder', folderSchema)

module.exports = Folder
