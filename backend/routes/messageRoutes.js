const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// 💬 Get message history between two users
router.get("/:user1/:user2", async (req, res) => {
    try {
        const { user1, user2 } = req.params;
        const messages = await Message.find({
            $or: [
                { sender: user1, receiver: user2 },
                { sender: user2, receiver: user1 }
            ]
        }).sort({ time: 1 }).limit(100);

        res.json(messages);
    } catch (e) {
        console.error("Get messages error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// 💬 Get public chat history
router.get("/public", async (req, res) => {
    try {
        const messages = await Message.find({ receiver: "PUBLIC" })
            .sort({ time: 1 }).limit(100);
        res.json(messages);
    } catch (e) {
        console.error("Get public messages error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

module.exports = router;