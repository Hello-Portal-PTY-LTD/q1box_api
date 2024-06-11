const mongoose = require('mongoose')

// Plugin for pagination
const paginationPlugin = schema => {
  schema.query.paginate = function ({ page = 1, limit = 10 }) {
    const skip = (page - 1) * limit
    return this.skip(skip).limit(limit)
  }
}

module.exports = paginationPlugin
