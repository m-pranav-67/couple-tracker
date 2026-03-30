const express = require("express");
const router = express.Router();
const Race = require("../models/Race");
const User = require("../models/User");
const Task = require("../models/Task");

// 🏁 CREATE RACE
router.post("/create", async (req, res) => {
    try {
        const { user1, user2 } = req.body;

        if (!user1 || !user2) {
            return res.status(400).json({ error: "Both users required" });
        }
        if (user1 === user2) {
            return res.status(400).json({ error: "Cannot race yourself" });
        }

        const [u1, u2] = await Promise.all([
            User.findOne({ username: user1 }),
            User.findOne({ username: user2 })
        ]);

        if (!u1) return res.status(404).json({ error: `User "${user1}" not found` });
        if (!u2) return res.status(404).json({ error: `User "${user2}" not found. Ask them to register first!` });

        const today = new Date().toISOString().split("T")[0];

        let race = await Race.findOne({
            date: today,
            $or: [
                { user1, user2 },
                { user1: user2, user2: user1 }
            ]
        });

        if (!race) {
            const [task1, task2] = await Promise.all([
                Task.findOne({ userId: user1 }),
                Task.findOne({ userId: user2 })
            ]);

            const prog1 = task1 ? task1.tasks.filter(t => t.completed && t.date === today).length : 0;
            const prog2 = task2 ? task2.tasks.filter(t => t.completed && t.date === today).length : 0;

            race = new Race({ user1, user2, date: today, progress1: prog1, progress2: prog2 });
            await race.save();
        }

        await Promise.all([
            User.findOneAndUpdate({ username: user1 }, { partner: user2 }),
            User.findOneAndUpdate({ username: user2 }, { partner: user1 })
        ]);

        res.json({ success: true, race });
    } catch (e) {
        console.error("Race create error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// 📊 GET RACE
router.get("/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const today = new Date().toISOString().split("T")[0];

        const race = await Race.findOne({
            date: today,
            $or: [{ user1: userId }, { user2: userId }]
        });

        res.json(race || null);
    } catch (e) {
        console.error("Get race error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

module.exports = router;