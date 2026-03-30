const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Express App
const app = express();
const server = http.createServer(app);

// ==================== CONFIG ====================
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/couple-tracker";
const PORT = process.env.PORT || 5000;

// ==================== SOCKET.IO ====================
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Pass `io` to routes
app.set("io", io);

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// ==================== DATABASE ====================
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ Mongo Error:", err));

// ==================== MODELS ====================
const Message = require("./models/Message");

// ==================== ROUTES ====================
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const raceRoutes = require("./routes/raceRoutes");
const messageRoutes = require("./routes/messageRoutes");
const userRoutes = require("./routes/userRoutes");

app.use("/api", authRoutes); // /api/login, /api/register
app.use("/api/tasks", taskRoutes);
app.use("/api/race", raceRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);

// ==================== SOCKET.IO HANDLER ====================
let connectedUsers = {}; // username -> socketId

io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    socket.on("join", (userId) => {
        if (!userId) return;
        connectedUsers[userId] = socket.id;
        socket.userId = userId;
        console.log("👤 Join:", userId);
        io.emit("onlineUsers", Object.keys(connectedUsers));
    });

    // 💬 PUBLIC CHAT — save to DB + broadcast
    socket.on("publicMessage", async ({ sender, msg }) => {
        if (!sender || !msg) return;

        try {
            const message = new Message({ sender, receiver: "PUBLIC", message: msg });
            await message.save();
        } catch (e) {
            console.error("Save public message error:", e);
        }

        io.emit("publicMessage", { sender, msg, timestamp: new Date() });
    });

    // 💬 PRIVATE CHAT — save to DB + send
    socket.on("sendMessage", async ({ sender, receiver, msg }) => {
        if (!sender || !receiver || !msg) return;

        try {
            const message = new Message({ sender, receiver, message: msg });
            await message.save();
        } catch (e) {
            console.error("Save private message error:", e);
        }

        const receiverSocketId = connectedUsers[receiver];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("receiveMessage", { sender, msg, timestamp: new Date(), isMine: false });
        }
        // Also send to the sender so they see their own message
        socket.emit("receiveMessage", { sender, msg, timestamp: new Date(), isMine: true });
    });

    socket.on("disconnect", () => {
        console.log("❌ Socket disconnected:", socket.id);
        for (let user in connectedUsers) {
            if (connectedUsers[user] === socket.id) {
                delete connectedUsers[user];
            }
        }
        io.emit("onlineUsers", Object.keys(connectedUsers));
    });
});

// ==================== FRONTEND FALLBACK ====================
// Handle missing frontend paths directly to login instead of 404
app.use((req, res) => {
    if (req.path.startsWith("/api")) {
        res.status(404).json({ error: "Route not found: " + req.method + " " + req.path });
    } else {
        res.sendFile(path.join(__dirname, "../frontend", "index.html"));
    }
});

// ==================== START SERVER ====================
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving frontend from: ${path.join(__dirname, "../frontend")}`);
});