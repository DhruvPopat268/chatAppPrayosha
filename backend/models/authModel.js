const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  pushSubscription: { type: Object, default: null },
  oneSignalPlayerId: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
