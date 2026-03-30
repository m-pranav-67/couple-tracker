// =============================================
// 🔑 AUTH + INITIALIZATION
// =============================================
const userId = localStorage.getItem("userId");
const token = localStorage.getItem("token");

if (!userId || !token) {
    if (window.location.pathname.includes("dashboard.html")) {
        window.location.href = "index.html";
    }
}

let selectedDate = new Date().toISOString().split("T")[0];
let raceData = null;
let partnerName = localStorage.getItem("partner") || null;
let calendarInstance = null;
let gameOver = false;
const FINISH_TASKS = 7; // tasks needed to win

const BASE_URL = window.location.origin;

const getHeaders = () => ({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
});

// =============================================
// 🔌 SOCKET.IO SETUP
// =============================================
let socket = null;

if (typeof io !== 'undefined') {
    socket = io();
    
    socket.on("connect", () => {
        console.log("✅ Socket connected:", socket.id);
        socket.emit("join", userId);
    });

    socket.on("connect_error", (err) => {
        console.error("❌ Socket connection error:", err.message);
    });

    socket.on("publicMessage", ({ sender, msg }) => {
        appendPublicMessage(sender, msg);
    });

    socket.on("receiveMessage", ({ sender, msg, isMine }) => {
        appendPrivateMessage(sender, msg, isMine);
    });

    socket.on("onlineUsers", (userList) => {
        const usersBox = document.getElementById("users");
        if (!usersBox) return;

        usersBox.innerHTML = "";
        const others = userList.filter(u => u !== userId);

        if (others.length === 0) {
            usersBox.innerHTML = `<span class="offline-msg">No one else online</span>`;
            return;
        }

        others.forEach(user => {
            const span = document.createElement("span");
            span.className = "online-user";
            span.innerText = "🟢 " + user;
            usersBox.appendChild(span);
        });
    });

    // 🏁 REAL-TIME RACE PROGRESS (from other user's task completion)
    socket.on("raceProgressUpdate", ({ userId: uid, progress }) => {
        if (uid === userId) return; // ignore own updates (handled locally)
        
        console.log(`🏁 Partner ${uid} progress: ${progress}`);
        
        if (raceData) {
            if (raceData.user1 === uid) raceData.progress1 = progress;
            else if (raceData.user2 === uid) raceData.progress2 = progress;
        }
        
        setCarPosition("car-partner", progress, uid, false);
        
        const partnerCountEl = document.getElementById("partner-progress-count");
        if (partnerCountEl) partnerCountEl.textContent = `${progress} tasks done`;
    });
}

// =============================================
// 🚀 DOM READY — INITIALIZATION & LISTENERS
// =============================================
document.addEventListener("DOMContentLoaded", async () => {
    // Only run on dashboard
    if (!document.getElementById("taskList")) return;

    // Attach Event Listeners Safely
    const addTaskBtn = document.getElementById("add-task-btn");
    if (addTaskBtn) addTaskBtn.addEventListener("click", addTask);

    const createRaceBtn = document.querySelector(".card-race-start .btn-primary");
    if (createRaceBtn) createRaceBtn.addEventListener("click", createRace);

    const publicSendBtn = document.querySelector("#publicMsg").nextElementSibling;
    if (publicSendBtn) publicSendBtn.addEventListener("click", sendPublic);

    const privateSendBtn = document.querySelector("#msg").nextElementSibling;
    if (privateSendBtn) privateSendBtn.addEventListener("click", sendMsg);

    const publicMsgInput = document.getElementById("publicMsg");
    if (publicMsgInput) publicMsgInput.addEventListener("keypress", e => { if (e.key === "Enter") sendPublic(); });

    const msgInput = document.getElementById("msg");
    if (msgInput) msgInput.addEventListener("keypress", e => { if (e.key === "Enter") sendMsg(); });

    const taskInput = document.getElementById("taskInput");
    if (taskInput) taskInput.addEventListener("keypress", e => { if (e.key === "Enter") addTask(); });

    const partnerInput = document.getElementById("partner");
    if (partnerInput) partnerInput.addEventListener("keypress", e => { if (e.key === "Enter") createRace(); });

    // Set welcome text
    const welcomeEl = document.getElementById("welcome");
    if (welcomeEl) welcomeEl.innerText = `Welcome back, ${userId}! 👋`;

    const userCar = document.getElementById("car-user");
    if (userCar) userCar.title = userId;
    
    const labelUser = document.getElementById("label-user");
    if (labelUser) labelUser.innerText = `🚗 ${userId}`;

    // Initial Data Fetch
    await loadRace();
    await loadTasks();
    await loadPublicHistory();

    if (partnerName) {
        await loadPrivateHistory(partnerName);
    }
});

// =============================================
// ➕ COMPLETE / ADD / DELETE TASKS
// =============================================
async function addTask() {
    const input = document.getElementById("taskInput");
    const text = input ? input.value.trim() : "";
    const msgEl = document.getElementById("task-add-message");

    if (!text) {
        showInlineMsg(msgEl, "⚠️ Please enter a task first", "error");
        return;
    }

    const btn = document.getElementById("add-task-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Adding..."; }

    try {
        const res = await fetch(`${BASE_URL}/api/tasks`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ userId, text, date: selectedDate })
        });

        const data = await res.json();
        if (!res.ok || data.error) {
            showInlineMsg(msgEl, data.error || "Failed to add task", "error");
            return;
        }

        input.value = "";
        showInlineMsg(msgEl, "✅ Task added!", "success");
        setTimeout(() => { if (msgEl) msgEl.textContent = ""; }, 2000);
        await loadTasks();
    } catch (e) {
        console.error("Add task error:", e);
        showInlineMsg(msgEl, "❌ Connection error", "error");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Add Task"; }
    }
}

async function completeTask(index) {
    try {
        const res = await fetch(`${BASE_URL}/api/tasks/complete`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ userId, index })
        });
        const data = await res.json();
        if (!res.ok || data.error) return;
        await loadTasks();
    } catch (e) {
        console.error("Complete task error:", e);
    }
}

async function deleteTask(index) {
    try {
        const res = await fetch(`${BASE_URL}/api/tasks/delete`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ userId, index })
        });
        const data = await res.json();
        if (!res.ok || data.error) return;
        await loadTasks();
    } catch (e) {
        console.error("Delete task error:", e);
    }
}

// =============================================
// 📥 LOAD TASKS
// =============================================
async function loadTasks() {
    try {
        const res = await fetch(`${BASE_URL}/api/tasks/${userId}`, {
            headers: getHeaders()
        });
        if (!res.ok) return;

        const tasks = await res.json();
        renderTaskList(tasks);
        updateProgress(tasks);
        updateMyCarFromTasks(tasks);
        updateCalendar(tasks);
    } catch (e) {
        console.error("Load tasks error:", e);
    }
}

function renderTaskList(tasks) {
    const container = document.getElementById("taskList");
    if (!container) return;

    const todayTasks = tasks.filter(t => t.date === selectedDate);
    if (todayTasks.length === 0) {
        container.innerHTML = `<div class="empty-state">No tasks for today — add one above! 👆</div>`;
        return;
    }

    container.innerHTML = "";
    tasks.forEach((task, globalIndex) => {
        if (task.date !== selectedDate) return;

        const div = document.createElement("div");
        div.className = `task-item${task.completed ? " completed" : ""}`;

        const textSpan = document.createElement("span");
        textSpan.className = "task-text";
        textSpan.innerText = task.text;
        div.appendChild(textSpan);

        const actions = document.createElement("div");
        actions.className = "task-actions";

        if (!task.completed) {
            const completeBtn = document.createElement("button");
            completeBtn.innerHTML = "✔ Done";
            completeBtn.className = "task-btn complete-btn";
            completeBtn.addEventListener("click", () => completeTask(globalIndex));
            actions.appendChild(completeBtn);
        } else {
            const doneTag = document.createElement("span");
            doneTag.className = "done-tag";
            doneTag.innerText = "✅";
            actions.appendChild(doneTag);
        }

        const deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = "🗑";
        deleteBtn.className = "task-btn delete-btn";
        deleteBtn.addEventListener("click", () => deleteTask(globalIndex));
        actions.appendChild(deleteBtn);

        div.appendChild(actions);
        container.appendChild(div);
    });
}

// =============================================
// 📊 PROGRESS & CAR UPDATES
// =============================================
function updateProgress(tasks) {
    const todayTasks = tasks.filter(t => t.date === selectedDate);
    const done = todayTasks.filter(t => t.completed).length;
    const total = todayTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const countEl = document.querySelector(".progress-count");
    if (countEl) countEl.textContent = `${done}/${total}`;

    const bar = document.getElementById("progress-bar");
    if (bar) bar.style.width = pct + "%";
}

function updateMyCarFromTasks(tasks) {
    const today = new Date().toISOString().split("T")[0];
    const done = tasks.filter(t => t.date === today && t.completed).length;

    setCarPosition("car-user", done, userId, true);

    if (done >= FINISH_TASKS && !gameOver) {
        triggerWinner(userId);
    }
}

function setCarPosition(carId, progress, playerName, isMe) {
    const trackWidth = document.querySelector(".race")?.clientWidth || 800;
    const usableWidth = trackWidth - 120; // 60px padding on each side
    const pct = Math.min((progress || 0) / FINISH_TASKS, 1);
    const xPos = 10 + Math.round(pct * usableWidth);

    const carEl = document.getElementById(carId);
    if (carEl) {
        carEl.style.left = xPos + "px";
        carEl.style.transform = "none";
    }

    if (isMe) {
        const userLabel = document.getElementById("user-progress-label");
        if (userLabel) userLabel.textContent = `You: ${progress} tasks`;
    } else {
        const partnerLabel = document.getElementById("partner-progress-label");
        if (partnerLabel) partnerLabel.textContent = `${playerName}: ${progress || 0} tasks`;
    }
}

function triggerWinner(winnerUserId) {
    if (gameOver) return;
    gameOver = true;
    const text = winnerUserId === userId ? "🏆 YOU WIN! Amazing job!" : `💔 ${winnerUserId} Wins! Keep going!`;
    const winnerEl = document.getElementById("winner");
    if (winnerEl) {
        winnerEl.innerText = text;
        winnerEl.style.display = "flex";
    }
}

// =============================================
// 🏁 LOAD AND CREATE RACE
// =============================================
async function loadRace() {
    try {
        const res = await fetch(`${BASE_URL}/api/race/${userId}`, {
            headers: getHeaders()
        });
        if (!res.ok) return;

        const data = await res.json();
        if (!data || !data.user1) return;

        raceData = data;
        const partner = data.user1 === userId ? data.user2 : data.user1;
        partnerName = partner;
        localStorage.setItem("partner", partner);

        const partnerCar = document.getElementById("car-partner");
        if (partnerCar) {
            partnerCar.title = partner;
            partnerCar.textContent = "🚙";
        }
        const labelPartner = document.getElementById("label-partner");
        if (labelPartner) labelPartner.innerText = `🚙 ${partner}`;

        const raceInfo = document.getElementById("current-race-info");
        if (raceInfo) raceInfo.style.display = "block";
        const raceVsText = document.getElementById("race-vs-text");
        if (raceVsText) raceVsText.textContent = `${data.user1} vs ${data.user2}`;

        // Set partner progress
        const partnerProgress = data.user1 === userId ? data.progress2 : data.progress1;
        setCarPosition("car-partner", partnerProgress, partner, false);
        
        const partnerNameDisp = document.getElementById("partner-name-display");
        if (partnerNameDisp) partnerNameDisp.textContent = partner;
        const partnerProg = document.getElementById("partner-progress");
        if (partnerProg) partnerProg.style.display = "block";

        const partnerCountEl = document.getElementById("partner-progress-count");
        if (partnerCountEl) partnerCountEl.textContent = `${partnerProgress || 0} tasks done`;

        await loadPrivateHistory(partner);

    } catch (e) {
        console.error("Load race error:", e);
    }
}

async function createRace() {
    const partner = document.getElementById("partner")?.value.trim();
    const msgEl = document.getElementById("race-message");

    if (!partner) { showInlineMsg(msgEl, "⚠️ Enter your partner's username", "error"); return; }
    if (partner === userId) { showInlineMsg(msgEl, "⚠️ You cannot race yourself", "error"); return; }

    try {
        const res = await fetch(`${BASE_URL}/api/race/create`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ user1: userId, user2: partner })
        });

        const data = await res.json();
        if (!res.ok || data.error) {
            showInlineMsg(msgEl, data.error || "Failed to create race", "error");
            return;
        }

        showInlineMsg(msgEl, `🏁 Race started! vs ${partner}`, "success");
        document.getElementById("partner").value = "";

        await loadRace();
        await loadTasks();
    } catch (e) {
        console.error("Create race error:", e);
        showInlineMsg(msgEl, "❌ Connection error", "error");
    }
}

// =============================================
// 👀 LEADERBOARD
// =============================================
async function loadOthers() {
    try {
        const res = await fetch(`${BASE_URL}/api/users/leaderboard`, {
            headers: getHeaders()
        });
        if (!res.ok) return;

        const data = await res.json();
        const box = document.getElementById("others");
        if (!box) return;

        if (!data || data.length === 0) {
            box.innerHTML = `<div class="empty-state">No data yet — complete some tasks to appear here! 🚀</div>`;
            return;
        }

        box.innerHTML = "";
        data.forEach((u, idx) => {
            const isMe = u.userId === userId;
            const pct = u.total > 0 ? Math.round((u.completed / u.total) * 100) : 0;
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

            const div = document.createElement("div");
            div.className = `leaderboard-item${isMe ? " leaderboard-me" : ""}`;
            div.innerHTML = `
                <div class="lb-rank">${medal}</div>
                <div class="lb-info">
                    <div class="lb-name">${u.userId}${isMe ? " <span class='you-tag'>YOU</span>" : ""}</div>
                    <div class="lb-bar-wrap">
                        <div class="lb-bar" style="width:${pct}%"></div>
                    </div>
                </div>
                <div class="lb-stats">
                    <div class="lb-today">${u.completed}/${u.total} today</div>
                    <div class="lb-alltime">${u.allTimeCompleted} all-time</div>
                </div>
            `;
            box.appendChild(div);
        });
    } catch (e) {
        console.error("Load leaderboard error:", e);
    }
}

// =============================================
// 💬 CHAT
// =============================================
async function loadPublicHistory() {
    try {
        const res = await fetch(`${BASE_URL}/api/messages/public`, { headers: getHeaders() });
        if (!res.ok) return;
        const messages = await res.json();
        const box = document.getElementById("publicMessages");
        if (box) box.innerHTML = "";
        messages.forEach(m => appendPublicMessage(m.sender, m.message));
    } catch (e) {
        console.error("Load public history error:", e);
    }
}

async function loadPrivateHistory(partner) {
    try {
        const res = await fetch(`${BASE_URL}/api/messages/${userId}/${partner}`, { headers: getHeaders() });
        if (!res.ok) return;
        const box = document.getElementById("messages");
        if (box) box.innerHTML = "";
        const messages = await res.json();
        messages.forEach(m => appendPrivateMessage(m.sender, m.message, m.sender === userId));
    } catch (e) {
        console.error("Load private history error:", e);
    }
}

function sendPublic() {
    const input = document.getElementById("publicMsg");
    const msg = input ? input.value.trim() : "";
    if (!msg || !socket) return;
    socket.emit("publicMessage", { sender: userId, msg });
    input.value = "";
}

function sendMsg() {
    const input = document.getElementById("msg");
    const msg = input ? input.value.trim() : "";
    if (!msg) return;
    if (!partnerName) {
        alert("⚠️ You need to start a race first to chat with your partner!");
        return;
    }
    if (socket) socket.emit("sendMessage", { sender: userId, receiver: partnerName, msg });
    input.value = "";
}

function appendPublicMessage(sender, msg) {
    const box = document.getElementById("publicMessages");
    if (!box) return;
    const div = document.createElement("div");
    div.className = `chat-msg${sender === userId ? " mine" : " theirs"}`;
    div.innerHTML = `<span class="chat-sender">${sender}</span><span class="chat-text">${escapeHtml(msg)}</span>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function appendPrivateMessage(sender, msg, isMine = false) {
    const box = document.getElementById("messages");
    if (!box) return;
    const isMyMsg = sender === userId || isMine;
    const div = document.createElement("div");
    div.className = `chat-msg${isMyMsg ? " mine" : " theirs"}`;
    div.innerHTML = `<span class="chat-sender">${sender}</span><span class="chat-text">${escapeHtml(msg)}</span>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// =============================================
// 📅 CALENDAR
// =============================================
function updateCalendar(tasks) {
    const calendarEl = document.getElementById("calendar");
    if (!calendarEl || typeof FullCalendar === "undefined") return;

    const events = tasks.map(task => ({
        title: (task.completed ? "✅ " : "⭕ ") + task.text,
        date: task.date,
        backgroundColor: task.completed ? "#11998e" : "#667eea",
        borderColor: task.completed ? "#0d7a6e" : "#5568d3",
        textColor: "#fff"
    }));

    if (!calendarInstance) {
        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: "dayGridMonth",
            headerToolbar: {
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth"
            },
            height: "auto",
            events: events,
            eventClick: function(info) {
                info.jsEvent.preventDefault();
            }
        });
        calendarInstance.render();
        window.calendarInstance = calendarInstance;
    } else {
        calendarInstance.removeAllEvents();
        events.forEach(ev => calendarInstance.addEvent(ev));
    }
}

// =============================================
// 🛠 HELPERS
// =============================================
function showInlineMsg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `inline-message ${type}`;
}

function escapeHtml(str) {
    const d = document.createElement("div");
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
}

// Ensure `leaderboard` data is fetched proactively when tab is clicked
document.querySelectorAll(".nav-btn[data-section='leaderboard']").forEach(btn => {
    btn.addEventListener("click", loadOthers);
});