const express = require("express");
const router = express.Router();
const User = require("../models/User");

// 📝 REGISTER
router.post("/register", async (req, res) => {
    const { username, password } = req.body;

    const existing = await User.findOne({ username });
    if (existing) {
        return res.json({ message: "User already exists" });
    }

    const user = new User({ username, password });
    await user.save();

    res.json({ message: "Registered successfully" });
});

// 🔐 LOGIN
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username, password });

    if (!user) {
        return res.json({ message: "Invalid credentials" });
    }

    res.json({ message: "Login success", username });
});

module.exports = router;