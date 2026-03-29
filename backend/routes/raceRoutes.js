const express = require("express");
const router = express.Router();
const Race = require("../models/Race");
const User = require("../models/User");
const Task = require("../models/Task");

// 📅 TODAY
function today() {
    return new Date().toISOString().split("T")[0];
}

console.log("🏁 RACE ROUTES LOADED");

// ======================================
// 🏁 CREATE / START RACE
// ======================================
router.post("/create", async (req, res) => {
    console.log("🏁 POST /race/create endpoint hit");
    try {
        const { user1, user2 } = req.body;

        console.log("Race create request:", { user1, user2 });

        if (!user1 || !user2) {
            return res.status(400).json({ error: "Both users required" });
        }

        if (user1 === user2) {
            return res.status(400).json({ error: "Cannot race with yourself" });
        }

        // ✅ Prevent duplicate race
        let race = await Race.findOne({
            date: today(),
            $or: [
                { user1, user2 },
                { user1: user2, user2: user1 }
            ]
        });

        if (!race) {
            race = new Race({
                user1,
                user2,
                date: today()
            });

            await race.save();
            console.log("Race created:", race);
        } else {
            console.log("Race already exists:", race);
        }

        res.json(race);

    } catch (err) {
        console.error("Race create error:", err);
        res.status(500).json({ error: "Server error: " + err.message });
    }
});

// ======================================
// 📊 GET RACE PROGRESS (FIXED)
// ======================================
router.get("/progress/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;

        const tasks = await Task.findOne({ userId });

        const todayTasks = tasks?.tasks?.filter(t => t.date === today()) || [];
        const completed = todayTasks.filter(t => t.completed).length;

        res.json({
            progress: completed,
            total: todayTasks.length
        });

    } catch (err) {
        console.log("Progress error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ======================================
// 📥 GET TODAY RACE (KEEP LAST!)
// ======================================
router.get("/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;

        const race = await Race.findOne({
            date: today(),
            $or: [
                { user1: userId },
                { user2: userId }
            ]
        });

        res.json(race || null);

    } catch (err) {
        console.log("Race fetch error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;