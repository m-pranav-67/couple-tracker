// =====================================
// 👤 USER + INITIALIZATION
// =====================================
const userId = localStorage.getItem("userId") || "Pranav";
localStorage.setItem("userId", userId);

let selectedDate = new Date().toISOString().split("T")[0];
let raceData = null;
let partnerName = null;
let calendar = null;

// Game settings
const FINISH = 500;
let gameOver = false;

// =====================================
// 🌐 BASE URL (AUTO PRODUCTION SAFE)
// =====================================
const BASE_URL = window.location.origin;

// Socket (IMPORTANT FIX)
const socket = io();
socket.emit("join", userId);

// Set welcome
document.addEventListener("DOMContentLoaded", () => {
    const welcomeEl = document.getElementById("welcome");
    if (welcomeEl) {
        welcomeEl.innerText = "Welcome " + userId;
    }
});

// =====================================
// ➕ ADD TASK
// =====================================
async function addTask() {
    const text = document.getElementById("taskInput").value;
    if (!text) return alert("Enter a task");

    try {
        await fetch(`${BASE_URL}/tasks/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, text, date: selectedDate })
        });

        document.getElementById("taskInput").value = "";
        await loadTasks();
    } catch (e) {
        console.error("Error adding task:", e);
        alert("Failed to add task");
    }
}

// =====================================
// ✅ COMPLETE TASK
// =====================================
async function completeTask(index) {
    try {
        await fetch(`${BASE_URL}/tasks/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, index })
        });

        await loadTasks();
    } catch (e) {
        console.error("Error completing task:", e);
    }
}

// =====================================
// 🗑 DELETE TASK
// =====================================
async function deleteTask(index) {
    try {
        await fetch(`${BASE_URL}/tasks/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, index })
        });

        await loadTasks();
    } catch (e) {
        console.error("Error deleting task:", e);
    }
}

// =====================================
// 📥 LOAD TASKS
// =====================================
async function loadTasks() {
    try {
        const res = await fetch(`${BASE_URL}/tasks/${userId}`);
        const tasks = await res.json();

        const container = document.getElementById("taskList");
        container.innerHTML = "";

        tasks.forEach((task, index) => {
            if (task.date === selectedDate) {
                const div = document.createElement("div");
                const span = document.createElement("span");
                span.innerText = task.text;

                if (task.completed) {
                    span.style.textDecoration = "line-through";
                }

                div.appendChild(span);

                if (!task.completed) {
                    const completeBtn = document.createElement("button");
                    completeBtn.innerHTML = "✔";
                    completeBtn.onclick = () => completeTask(index);
                    completeBtn.className = "btn";
                    div.appendChild(completeBtn);
                } else {
                    const checkmark = document.createElement("span");
                    checkmark.innerText = "✅";
                    div.appendChild(checkmark);
                }

                const deleteBtn = document.createElement("button");
                deleteBtn.innerHTML = "🗑";
                deleteBtn.onclick = () => deleteTask(index);
                deleteBtn.className = "btn";
                div.appendChild(deleteBtn);

                container.appendChild(div);
            }
        });

        updateMyCarPosition(tasks);
        updateCalendar(tasks);
        showProgress(tasks);
        await loadOthers();

    } catch (e) {
        console.error("Error loading tasks:", e);
    }
}

// =====================================
// 🚗 UPDATE CAR POSITION
// =====================================
function updateMyCarPosition(tasks) {
    const done = tasks.filter(t => t.completed && t.date === selectedDate).length;
    const pos = done * 80;

    const car = document.getElementById("car-" + userId);
    if (car) {
        car.style.transform = `translateX(${pos}px)`;
        car.innerText = "🚗 " + userId;
        checkWinner(userId, pos);
    }

    if (raceData && partnerName) {
        socket.emit("raceProgress", { userId, partnerName, progress: done });
    }
}

// =====================================
// 🏁 FIX CAR IDS
// =====================================
document.addEventListener("DOMContentLoaded", () => {
    const myCar = document.getElementById("car-user");
    if (myCar) {
        myCar.id = "car-" + userId;
        myCar.innerText = "🚗 " + userId;
    }

    setTimeout(() => loadRace(), 100);
});

// =====================================
// 🏁 PARTNER CAR MOVEMENT
// =====================================
socket.on("raceProgress", ({ userId: uid, progress }) => {
    if (uid === userId) return;

    const car = document.getElementById("car-" + uid);
    if (car) {
        const pos = progress * 80;
        car.style.transform = `translateX(${pos}px)`;
        checkWinner(uid, pos);
    }
});

// =====================================
// 🏆 CHECK WINNER
// =====================================
function checkWinner(user, position) {
    if (gameOver) return;

    if (position >= FINISH) {
        gameOver = true;
        const text = user === userId ? "🏆 You Win!" : `💔 ${user} Wins!`;
        const winnerEl = document.getElementById("winner");
        if (winnerEl) winnerEl.innerText = text;

        setTimeout(() => alert(text), 200);
    }
}

// =====================================
// 🏁 LOAD RACE
// =====================================
async function loadRace() {
    try {
        const res = await fetch(`${BASE_URL}/race/${userId}`);
        const data = await res.json();

        if (!data || !data.user1) return;

        raceData = data;
        gameOver = false;
        document.getElementById("winner").innerText = "";

        const partner = data.user1 === userId ? data.user2 : data.user1;
        partnerName = partner;

        const partnerCar = document.getElementById("car-partner");
        if (partnerCar) {
            partnerCar.id = "car-" + partner;
            partnerCar.innerText = "🚙 " + partner;
        }

    } catch (e) {
        console.error("Race load error:", e);
    }
}

// =====================================
// 🏁 CREATE RACE
// =====================================
async function createRace() {
    const partner = document.getElementById("partner").value;

    if (!partner) return alert("Enter partner username");
    if (partner === userId) return alert("Cannot race yourself");

    try {
        const res = await fetch(`${BASE_URL}/race/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user1: userId, user2: partner })
        });

        const data = await res.json();

        if (!res.ok || data.error) {
            alert(data.error || "Error creating race");
            console.error("Race creation error:", data);
            return;
        }

        alert("🏁 Race started!");
        document.getElementById("partner").value = "";
        await loadRace();
        await loadTasks();

    } catch (e) {
        console.error("Race creation error:", e);
        alert("Error: " + e.message);
    }
}

// =====================================
// 📊 PROGRESS
// =====================================
function showProgress(tasks) {
    const todayTasks = tasks.filter(t => t.date === selectedDate);
    const done = todayTasks.filter(t => t.completed).length;
    const total = todayTasks.length;

    const progressEl = document.getElementById("progress");
    if (progressEl) {
        progressEl.innerHTML = `<span>${done}/${total} tasks completed</span>`;
    }
}

// =====================================
// 👀 LEADERBOARD
// =====================================
async function loadOthers() {
    try {
        const res = await fetch(`${BASE_URL}/tasks/all/users`);
        const users = await res.json();

        const box = document.getElementById("others");
        box.innerHTML = "";

        users.sort((a, b) =>
            b.tasks.filter(t => t.completed).length -
            a.tasks.filter(t => t.completed).length
        );

        users.forEach((u, idx) => {
            const done = u.tasks.filter(t => t.completed).length;
            const div = document.createElement("div");
            div.innerHTML = `<span>#${idx + 1} ${u.userId}</span><span>${done} done</span>`;
            box.appendChild(div);
        });

    } catch (e) {
        console.error("Leaderboard error:", e);
    }
}

// =====================================
// 💬 CHAT
// =====================================
function sendPublic() {
    const msg = document.getElementById("publicMsg").value;
    if (!msg) return;

    socket.emit("publicMessage", { sender: userId, msg });
    document.getElementById("publicMsg").value = "";
}

socket.on("publicMessage", (data) => {
    const div = document.createElement("div");
    div.innerHTML = `<b>${data.sender}:</b> ${data.msg}`;
    document.getElementById("publicMessages").appendChild(div);
    // Auto scroll to latest message
    document.getElementById("publicMessages").scrollTop = document.getElementById("publicMessages").scrollHeight;
});

function sendMsg() {
    const receiver = document.getElementById("receiver").value;
    const msg = document.getElementById("msg").value;

    if (!msg || !receiver) return alert("Enter receiver and message");

    socket.emit("sendMessage", { sender: userId, receiver, msg });
    document.getElementById("msg").value = "";
}

socket.on("receiveMessage", (data) => {
    const div = document.createElement("div");
    div.innerHTML = `<b>${data.sender}:</b> ${data.msg}`;
    document.getElementById("messages").appendChild(div);
    // Auto scroll to latest message
    document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
});

// =====================================
// 👥 ONLINE USERS
// =====================================
socket.on("onlineUsers", (userList) => {
    console.log("Online users:", userList);
    const usersBox = document.getElementById("users");
    if (usersBox) {
        usersBox.innerHTML = "";
        userList.forEach(user => {
            if (user !== userId) {
                const div = document.createElement("div");
                div.innerText = "🟢 " + user;
                usersBox.appendChild(div);
            }
        });
    }
});

// =====================================
// 📊 PROGRESS UPDATE (from backend)
// =====================================
socket.on("progressUpdate", ({ userId: uid, progress }) => {
    console.log(uid + " progress:", progress);
    // Reload tasks to reflect the update
    loadTasks();
});

// =====================================
// 📅 CALENDAR SETUP
// =====================================
function updateCalendar(tasks) {
    const calendarEl = document.getElementById("calendar");
    if (!calendarEl) return;

    try {
        if (!calendar) {
            // Initialize calendar once
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: "dayGridMonth",
                plugins: ["dayGrid", "interaction"],
                headerToolbar: {
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth"
                },
                height: "auto",
                contentHeight: "auto",
                events: tasks.map(task => ({
                    title: task.completed ? "✅ " + task.text : "⭕ " + task.text,
                    date: task.date,
                    backgroundColor: task.completed ? "#84fab0" : "#667eea",
                    borderColor: task.completed ? "#11998e" : "#764ba2"
                }))
            });

            calendar.render();
            console.log("Calendar initialized");
        } else {
            // Update events if calendar exists
            calendar.removeAllEvents();
            calendar.addEventSource(
                tasks.map(task => ({
                    title: task.completed ? "✅ " + task.text : "⭕ " + task.text,
                    date: task.date,
                    backgroundColor: task.completed ? "#84fab0" : "#667eea",
                    borderColor: task.completed ? "#11998e" : "#764ba2"
                }))
            );
            console.log("Calendar updated");
        }
    } catch (e) {
        console.error("Calendar error:", e);
    }
}

// =====================================
// 🚀 INIT
// =====================================
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        loadRace();
        loadTasks();
    }, 200);
});