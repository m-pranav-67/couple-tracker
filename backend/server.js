const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

// SOCKET.IO
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// =======================
// ROUTES
// =======================

// ✅ PASS IO TO TASK ROUTES (for live car movement)
const taskRoutes = require("./routes/taskRoutes");
app.use("/tasks", taskRoutes(io));

app.use("/auth", require("./routes/authRoutes"));
app.use("/messages", require("./routes/messageRoutes"));
app.use("/race", require("./routes/raceRoutes"));

// =======================
// DATABASE
// =======================
mongoose.connect("mongodb://127.0.0.1:27017/coupleTracker")
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log("Mongo Error:", err));

// =======================
// ONLINE USERS
// =======================
let users = {}; // { username: socketId }

// =======================
// SOCKET LOGIC
// =======================
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // 🔗 JOIN
    socket.on("join", (username) => {
        if (!username) return;

        users[username] = socket.id;

        console.log("Users:", users);

        io.emit("onlineUsers", Object.keys(users));
    });

    // 🌐 PUBLIC CHAT
    socket.on("publicMessage", async ({ sender, msg }) => {
        if (!sender || !msg) return;

        try {
            await Message.create({
                sender,
                receiver: "ALL",
                message: msg
            });

            io.emit("publicMessage", { sender, msg });
        } catch (err) {
            console.log("Public message error:", err);
        }
    });

    // 💬 PRIVATE CHAT
    socket.on("sendMessage", async ({ sender, receiver, msg }) => {
        if (!sender || !receiver || !msg) return;

        try {
            await Message.create({ sender, receiver, message: msg });

            // SEND TO RECEIVER
            if (users[receiver]) {
                io.to(users[receiver]).emit("receiveMessage", {
                    sender,
                    msg
                });
            }

            // SEND BACK TO SENDER
            socket.emit("receiveMessage", {
                sender,
                msg
            });

        } catch (err) {
            console.log("Private message error:", err);
        }
    });

    // 🏁 RACE PROGRESS (REAL-TIME SYNC)
    socket.on("raceProgress", ({ userId, partnerName, progress }) => {
        if (!userId || !partnerName) return;

        console.log(`${userId} progress: ${progress}`);

        // SEND TO PARTNER
        if (users[partnerName]) {
            io.to(users[partnerName]).emit("raceProgress", {
                userId,
                progress
            });
        }

        // ALSO BROADCAST (SAFE FALLBACK)
        socket.broadcast.emit("raceProgress", {
            userId,
            progress
        });
    });

    // ❌ DISCONNECT
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        for (let user in users) {
            if (users[user] === socket.id) {
                delete users[user];
            }
        }

        io.emit("onlineUsers", Object.keys(users));
    });
});

// =======================
// START SERVER
// =======================
server.listen(5000, () => {
    console.log("Server running on port 5000 🚀");
});