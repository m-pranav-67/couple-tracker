const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true,
        trim: true
    },
    receiver: {
        type: String, // 'PUBLIC' or username string
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    time: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Message", messageSchema);