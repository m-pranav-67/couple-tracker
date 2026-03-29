const express = require("express");
const Task = require("../models/Task");

module.exports = (io) => {
    const router = express.Router();

    // ➕ ADD TASK
    router.post("/add", async (req, res) => {
        const { userId, text, date } = req.body;

        let taskDoc = await Task.findOne({ userId });

        if (!taskDoc) {
            taskDoc = new Task({
                userId,
                tasks: [{ text, date, completed: false }]
            });
        } else {
            taskDoc.tasks.push({ text, date, completed: false });
        }

        await taskDoc.save();

        res.json({ message: "Task added" });
    });

    // 📥 GET TASKS
    router.get("/:userId", async (req, res) => {
        const taskDoc = await Task.findOne({ userId: req.params.userId });
        res.json(taskDoc ? taskDoc.tasks : []);
    });

    // ✅ COMPLETE TASK (🔥 FIXED)
    router.post("/complete", async (req, res) => {
        const { userId, index } = req.body;

        const taskDoc = await Task.findOne({ userId });

        if (!taskDoc) return res.status(404).json({ message: "User not found" });

        taskDoc.tasks[index].completed = true;

        await taskDoc.save();

        // 🔥 COUNT COMPLETED TASKS
        const completedCount = taskDoc.tasks.filter(t => t.completed).length;

        // 🔥 EMIT PROGRESS UPDATE
        io.emit("progressUpdate", {
            userId,
            progress: completedCount
        });

        res.json({ message: "Done" });
    });

    // 👀 GET ALL USERS TASKS
    router.get("/all/users", async (req, res) => {
        const all = await Task.find();
        res.json(all);
    });

    // 🗑 DELETE TASK
    router.post("/delete", async (req, res) => {
        const { userId, index } = req.body;

        const taskDoc = await Task.findOne({ userId });

        taskDoc.tasks.splice(index, 1);

        await taskDoc.save();

        res.json({ message: "Deleted" });
    });

    return router;
};