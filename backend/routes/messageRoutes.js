const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// 📥 GET CHAT HISTORY
router.get("/:user1/:user2", async (req, res) => {
    const { user1, user2 } = req.params;

    const messages = await Message.find({
        $or: [
            { sender: user1, receiver: user2 },
            { sender: user2, receiver: user1 }
        ]
    }).sort({ time: 1 });

    res.json(messages);
});

// 🌐 PUBLIC HISTORY
router.get("/public/all", async (req, res) => {
    const messages = await Message.find({ receiver: "ALL" }).sort({ time: 1 });
    res.json(messages);
});

module.exports = router;