const mongoose = require("mongoose");

const raceSchema = new mongoose.Schema({
    user1: {
        type: String,
        required: true,
        trim: true
    },
    user2: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: String,
        required: true
    },
    progress1: {
        type: Number,
        default: 0
    },
    progress2: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("Race", raceSchema);