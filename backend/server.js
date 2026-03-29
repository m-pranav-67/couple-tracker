const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

// ==================== SOCKET.IO ====================
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// ==================== MODELS ====================
const User = require("./models/User");
const Task = require("./models/Task");
const Race = require("./models/Race");

// ==================== DATABASE ====================
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/couple-tracker")
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ Mongo Error:", err));

// ==================== API ROUTES ====================

// 📝 REGISTER
app.post("/api/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password required" });
        }

        const existing = await User.findOne({ username });
        if (existing) {
            return res.json({ error: "User already exists" });
        }

        const user = new User({ username, password });
        await user.save();

        res.json({ success: true, message: "Registered successfully", username });
    } catch (e) {
        console.error("Register error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// 🔐 LOGIN
app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password required" });
        }

        const user = await User.findOne({ username, password });

        if (!user) {
            return res.json({ error: "Invalid credentials" });
        }

        res.json({ success: true, message: "Login success", username });
    } catch (e) {
        console.error("Login error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// ➕ ADD TASK
app.post("/api/tasks", async (req, res) => {
    try {
        const { userId, text, date } = req.body;

        if (!userId || !text) {
            return res.status(400).json({ error: "userId and text required" });
        }

        let taskDoc = await Task.findOne({ userId });

        if (!taskDoc) {
            taskDoc = new Task({
                userId,
                tasks: [{ text, date: date || new Date().toISOString().split("T")[0], completed: false }]
            });
        } else {
            taskDoc.tasks.push({ text, date: date || new Date().toISOString().split("T")[0], completed: false });
        }

        await taskDoc.save();
        res.json({ success: true, message: "Task added" });
    } catch (e) {
        console.error("Add task error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// 📥 GET TASKS
app.get("/api/tasks/:userId", async (req, res) => {
    try {
        const taskDoc = await Task.findOne({ userId: req.params.userId });
        res.json(taskDoc ? taskDoc.tasks : []);
    } catch (e) {
        console.error("Get tasks error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// ✅ COMPLETE TASK
app.post("/api/tasks/complete", async (req, res) => {
    try {
        const { userId, index } = req.body;

        const taskDoc = await Task.findOne({ userId });

        if (!taskDoc) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!taskDoc.tasks[index]) {
            return res.status(404).json({ error: "Task not found" });
        }

        taskDoc.tasks[index].completed = true;
        await taskDoc.save();

        // Emit live update to all users
        io.emit("taskCompleted", { userId, progress: taskDoc.tasks.filter(t => t.completed).length });

        res.json({ success: true, message: "Task completed" });
    } catch (e) {
        console.error("Complete task error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// 🗑️ DELETE TASK
app.post("/api/tasks/delete", async (req, res) => {
    try {
        const { userId, index } = req.body;

        const taskDoc = await Task.findOne({ userId });

        if (!taskDoc) {
            return res.status(404).json({ error: "User not found" });
        }

        taskDoc.tasks.splice(index, 1);
        await taskDoc.save();

        res.json({ success: true, message: "Task deleted" });
    } catch (e) {
        console.error("Delete task error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// 👥 GET ALL USERS LEADERBOARD
app.get("/api/users/leaderboard", async (req, res) => {
    try {
        const allTasks = await Task.find();
        const leaderboard = allTasks.map(doc => ({
            userId: doc.userId,
            completed: doc.tasks.filter(t => t.completed).length,
            total: doc.tasks.length
        })).sort((a, b) => b.completed - a.completed);

        res.json(leaderboard);
    } catch (e) {
        console.error("Leaderboard error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// 🏁 CREATE RACE
app.post("/api/race/create", async (req, res) => {
    try {
        const { user1, user2 } = req.body;

        if (!user1 || !user2) {
            return res.status(400).json({ error: "Both users required" });
        }

        if (user1 === user2) {
            return res.status(400).json({ error: "Cannot race yourself" });
        }

        const today = new Date().toISOString().split("T")[0];

        let race = await Race.findOne({
            date: today,
            $or: [
                { user1, user2 },
                { user1: user2, user2: user1 }
            ]
        });

        if (!race) {
            race = new Race({ user1, user2, date: today });
            await race.save();
        }

        res.json({ success: true, race });
    } catch (e) {
        console.error("Race create error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// 📊 GET RACE
app.get("/api/race/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const today = new Date().toISOString().split("T")[0];

        const race = await Race.findOne({
            date: today,
            $or: [
                { user1: userId },
                { user2: userId }
            ]
        });

        res.json(race || null);
    } catch (e) {
        console.error("Get race error:", e);
        res.status(500).json({ error: "Server error: " + e.message });
    }
});

// ==================== SOCKET.IO ====================
let connectedUsers = {};

io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    socket.on("join", (userId) => {
        if (!userId) return;
        connectedUsers[userId] = socket.id;
        console.log("Join:", userId);
        io.emit("onlineUsers", Object.keys(connectedUsers));
    });

    // 💬 PUBLIC CHAT
    socket.on("publicMessage", ({ sender, msg }) => {
        if (sender && msg) {
            io.emit("publicMessage", { sender, msg, timestamp: new Date() });
        }
    });

    // 💬 PRIVATE CHAT
    socket.on("sendMessage", ({ sender, receiver, msg }) => {
        if (sender && receiver && msg) {
            const receiverSocket = connectedUsers[receiver];
            if (receiverSocket) {
                io.to(receiverSocket).emit("receiveMessage", { sender, msg, timestamp: new Date() });
            }
            socket.emit("messageDelivered", { receiver, msg });
        }
    });

    // 🏁 RACE PROGRESS
    socket.on("raceProgress", ({ userId, partnerName, progress }) => {
        io.emit("raceProgressUpdate", { userId, progress });
    });

    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
        for (let user in connectedUsers) {
            if (connectedUsers[user] === socket.id) {
                delete connectedUsers[user];
            }
        }
        io.emit("onlineUsers", Object.keys(connectedUsers));
    });
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
    res.status(404).json({ error: "Route not found: " + req.method + " " + req.path });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});