const { model, Schema } = require("mongoose");

const tokenBlacklistSchema = new Schema({
  token: { type: String, unique: true },
  createdAt: { type: Date, expires: "30d", default: Date.now },
});

const TokenBlacklist = model("TokenBlacklist", tokenBlacklistSchema);

module.exports = TokenBlacklist;
