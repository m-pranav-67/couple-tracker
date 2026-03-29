const mongoose = require("mongoose");

const raceSchema = new mongoose.Schema({
    user1: String,
    user2: String,
    date: String
});

module.exports = mongoose.model("Race", raceSchema);