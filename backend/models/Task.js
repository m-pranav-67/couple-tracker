const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        trim: true
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
            }
        }
    ]
}, {
    timestamps: true // 🔥 helps debugging & tracking
});

// 🔥 INDEX for faster lookup
taskSchema.index({ userId: 1 });

module.exports = mongoose.model("Task", taskSchema);