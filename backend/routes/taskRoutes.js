const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const Race = require("../models/Race");

// ✅ COMPLETE TASK
router.post("/complete", async (req, res) => {
    try {
        const { userId, index } = req.body;

        const taskDoc = await Task.findOne({ userId });
        if (!taskDoc) return res.status(404).json({ error: "No tasks found for user" });
        if (!taskDoc.tasks[index]) return res.status(404).json({ error: "Task not found" });

        taskDoc.tasks[index].completed = true;
        taskDoc.tasks[index].completedAt = new Date();
        await taskDoc.save();

        const today = new Date().toISOString().split("T")[0];
        const completedCount = taskDoc.tasks.filter(t => t.completed && t.date === today).length;

        // Update race progress in DB
        const race = await Race.findOne({
            date: today,
            $or: [{ user1: userId }, { user2: userId }]
        });

        if (race) {
            if (race.user1 === userId) race.progress1 = completedCount;
            else race.progress2 = completedCount;
            await race.save();
        }

        // Emit socket event
        const io = req.app.get("io");
        if (io) {
            io.emit("raceProgressUpdate", { userId, progress: completedCount });
        }

        res.json({ success: true, message: "Task completed", progress: completedCount });
    } catch (e) {
        console.error("Complete task error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// 🗑️ DELETE TASK
router.post("/delete", async (req, res) => {
    try {
        const { userId, index } = req.body;

        const taskDoc = await Task.findOne({ userId });
        if (!taskDoc) return res.status(404).json({ error: "No tasks found for user" });

        taskDoc.tasks.splice(index, 1);
        await taskDoc.save();

        res.json({ success: true, message: "Task deleted" });
    } catch (e) {
        console.error("Delete task error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// ➕ ADD TASK
router.post("/", async (req, res) => {
    try {
        const { userId, text, date } = req.body;

        if (!userId || !text) {
            return res.status(400).json({ error: "userId and text required" });
        }

        const taskDate = date || new Date().toISOString().split("T")[0];

        let taskDoc = await Task.findOne({ userId });

        if (!taskDoc) {
            taskDoc = new Task({
                userId,
                tasks: [{ text, date: taskDate, completed: false }]
            });
        } else {
            taskDoc.tasks.push({ text, date: taskDate, completed: false });
        }

        await taskDoc.save();
        res.json({ success: true, message: "Task added" });
    } catch (e) {
        console.error("Add task error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// 📥 GET TASKS
router.get("/:userId", async (req, res) => {
    try {
        const taskDoc = await Task.findOne({ userId: req.params.userId });
        res.json(taskDoc ? taskDoc.tasks : []);
    } catch (e) {
        console.error("Get tasks error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

module.exports = router;