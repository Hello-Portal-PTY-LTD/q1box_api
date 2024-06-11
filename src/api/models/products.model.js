const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  stripeProductId: {
    type: String,
    required: true,
  },
  plans: [],
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
