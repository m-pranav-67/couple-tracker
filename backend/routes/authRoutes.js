const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "couple_race_secret_key_2024";

function makeToken(username) {
    return jwt.sign({ username }, JWT_SECRET, { expiresIn: "7d" });
}

// 📝 REGISTER
router.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password required" });
        }
        if (username.length < 3) {
            return res.status(400).json({ error: "Username must be at least 3 characters" });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }

        const existing = await User.findOne({ username });
        if (existing) {
            return res.status(409).json({ error: "Username already taken" });
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashed });
        await user.save();

        const token = makeToken(username);
        res.json({ success: true, message: "Registered successfully", username, token });
    } catch (e) {
        console.error("Register error:", e);
        if (e.code === 11000) {
            return res.status(409).json({ error: "Username already taken" });
        }
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// 🔐 LOGIN
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password required" });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const token = makeToken(username);
        res.json({ success: true, message: "Login success", username, token, partner: user.partner });
    } catch (e) {
        console.error("Login error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

module.exports = router;