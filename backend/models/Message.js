const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    sender: String,
    receiver: String, // "ALL" for public chat
    message: String,
    time: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", messageSchema);