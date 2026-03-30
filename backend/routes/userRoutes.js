const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Task = require("../models/Task");

// ==================== LEADERBOARD ====================
router.get("/leaderboard", async (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const allTasks = await Task.find();

        const leaderboard = allTasks.map(doc => ({
            userId: doc.userId,
            completed: doc.tasks.filter(t => t.completed && t.date === today).length,
            total: doc.tasks.filter(t => t.date === today).length,
            allTimeCompleted: doc.tasks.filter(t => t.completed).length
        })).sort((a, b) => b.completed - a.completed);

        res.json(leaderboard);
    } catch (e) {
        console.error("Leaderboard error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// 👤 Get partner info
router.get("/:username", async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username }).select("-password");
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

module.exports = router;
