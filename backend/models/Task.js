const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    tasks: [
        {
            text: {
                type: String,
                required: true,
                trim: true
            },
            date: {
                type: String,
                required: true
            },
            completed: {
                type: Boolean,
                default: false
            },
            completedAt: {
                type: Date,
                default: null
            }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model("Task", taskSchema);