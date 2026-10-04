/* global supabase */

// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
const SUPABASE_URL = "https://aloypfcfajmrgdmqhkcx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6_7krellY2AtO7-5PPKqSQ_rnE2R_IL";

// Renamed client to avoid collisions with global 'supabase' library
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;
let isSignUpMode = false;
let chosenAvatar = "https://api.dicebear.com/7.x/bottts/svg?seed=Felix";

// Initialize Session on Load
window.addEventListener('DOMContentLoaded', async () => {
    // Check Supabase session
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadUserData();
        showApp();
    } else {
        showAuth();
    }

    // Attach event listeners
    const addReminderBtn = document.getElementById("addReminderBtn");
    if (addReminderBtn) {
        addReminderBtn.addEventListener("click", addReminder);
    }

    updateTimerDisplay();
    displayReminders();
    displayEvents();
});

// ==========================================
// 2. NAVIGATION & UI HELPERS
// ==========================================
function showSection(sectionId, evt) {
    const sections = document.querySelectorAll(".section");
    sections.forEach(sec => sec.classList.remove("active"));

    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => btn.classList.remove("active"));

    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.classList.add("active");
    }

    if (evt && evt.target) {
        evt.target.classList.add("active");
    }

    if (sectionId === 'dashboard') {
        refreshDashboardInfo();
    }
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// 3. AUTHENTICATION (SUPABASE)
// ==========================================
function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    document.getElementById('authTitle').innerText = isSignUpMode ? "Sign Up" : "Log In";
    document.getElementById('authSubmitBtn').innerText = isSignUpMode ? "Create Account" : "Log In";
    document.getElementById('switchText').innerText = isSignUpMode ? "Already have an account?" : "Need an account?";
    document.getElementById('switchLink').innerText = isSignUpMode ? "Log In" : "Sign Up";
    document.getElementById('signUpFields').classList.toggle('hidden', !isSignUpMode);
}

function selectAvatar(imgElement) {
    document.querySelectorAll('.avatar-options img').forEach(img => img.classList.remove('selected'));
    imgElement.classList.add('selected');
    chosenAvatar = imgElement.src;
}

async function handleAuth(e) {
    e.preventDefault();
    const emailInput = document.getElementById('authEmail') ? document.getElementById('authEmail').value.trim() : '';
    const passwordInput = document.getElementById('authPassword').value;

    if (isSignUpMode) {
        const usernameInput = document.getElementById('authUsername').value.trim();
        const fullName = document.getElementById('authFullName') ? document.getElementById('authFullName').value.trim() : '';
        const phone = document.getElementById('authPhone') ? document.getElementById('authPhone').value.trim() : '';

        const { data, error } = await supabaseClient.auth.signUp({
            email: emailInput,
            password: passwordInput,
        });

        if (error) return alert("Sign Up Error: " + error.message);

        if (data.user) {
            const { error: profileError } = await supabaseClient
                .from('profiles')
                .insert([{
                    id: data.user.id,
                    username: usernameInput,
                    full_name: fullName,
                    mobile: phone,
                    avatar_url: chosenAvatar
                }]);

            if (profileError) {
                alert("Profile Creation Error: " + profileError.message);
            } else {
                alert("Registration successful!");
                currentUser = data.user;
                await loadUserData();
                showApp();
            }
        }
    } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: emailInput,
            password: passwordInput
        });

        if (error) return alert("Login Error: " + error.message);

        currentUser = data.user;
        await loadUserData();
        showApp();
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentProfile = null;
    showAuth();
}

function showAuth() {
    document.getElementById('authPortal').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
}

function showApp() {
    document.getElementById('authPortal').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    showSection('tasks');
}

async function loadUserData() {
    if (!currentUser) return;

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        currentProfile = profile;
        const dashName = document.getElementById('dashProfileName');
        const dashPhone = document.getElementById('dashProfilePhone');
        const dashAvatar = document.getElementById('dashProfileAvatar');

        if (dashName) dashName.innerText = profile.full_name || profile.username;
        if (dashPhone) dashPhone.innerText = "Mobile: " + (profile.mobile || "Not set");
        if (dashAvatar && profile.avatar_url) dashAvatar.src = profile.avatar_url;
    }

    fetchTasks();
}

// ==========================================
// 4. DAILY TASKS (SUPABASE PERSISTENCE)
// ==========================================
let tasks = [];

async function fetchTasks() {
    if (!currentUser) return;

    const { data, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching tasks:", error);
        return;
    }

    tasks = data || [];
    renderTasks();
}

function renderTasks() {
    const list = document.getElementById("taskList");
    if (!list) return;

    list.innerHTML = "";
    let completedCount = 0;

    tasks.forEach(task => {
        if (task.completed) completedCount++;

        const li = document.createElement("li");
        li.className = "task";
        li.innerHTML = `
            <div class="task-left" style="display: flex; align-items: center; gap: 12px;">
                <input
                    type="checkbox"
                    ${task.completed ? "checked" : ""}
                    onchange="toggleTask('${task.id}', ${task.completed})"
                >
                <span style="${task.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                    ${escapeHTML(task.text)}
                </span>
            </div>
            <button
                type="button"
                class="delete-btn"
                onclick="deleteTask('${task.id}')">
                Delete
            </button>
        `;
        list.appendChild(li);
    });

    updateStatistics(tasks.length, completedCount);
    refreshDashboardInfo();
}

async function addTask() {
    const input = document.getElementById("taskInput");
    if (!input) return;

    const text = input.value.trim();
    if (!text) {
        input.focus();
        return;
    }

    const { error } = await supabaseClient
        .from('tasks')
        .insert([{ user_id: currentUser.id, text: text, completed: false }]);

    if (error) {
        alert("Error saving task: " + error.message);
    } else {
        input.value = "";
        fetchTasks();
    }
}

async function toggleTask(taskId, currentStatus) {
    const { error } = await supabaseClient
        .from('tasks')
        .update({ completed: !currentStatus })
        .eq('id', taskId);

    if (error) alert("Error updating task: " + error.message);
    else fetchTasks();
}

async function deleteTask(taskId) {
    const { error } = await supabaseClient
        .from('tasks')
        .delete()
        .eq('id', taskId);

    if (error) alert("Error deleting task: " + error.message);
    else fetchTasks();
}

function updateStatistics(total, completed) {
    const remaining = total - completed;

    const totalTasks = document.getElementById("totalTasks");
    const completedTasks = document.getElementById("completedTasks");
    const remainingTasks = document.getElementById("remainingTasks");

    const dashboardTotal = document.getElementById("dashboardTotal");
    const dashboardCompleted = document.getElementById("dashboardCompleted");
    const dashboardRemaining = document.getElementById("dashboardRemaining");

    if (totalTasks) totalTasks.innerText = total;
    if (completedTasks) completedTasks.innerText = completed;
    if (remainingTasks) remainingTasks.innerText = remaining;

    if (dashboardTotal) dashboardTotal.innerText = total;
    if (dashboardCompleted) dashboardCompleted.innerText = completed;
    if (dashboardRemaining) dashboardRemaining.innerText = remaining;
}

function refreshDashboardInfo() {
    const pendingList = document.getElementById('dashboardPendingTasks');
    if (pendingList) {
        pendingList.innerHTML = "";
        const uncompleted = tasks.filter(t => !t.completed);
        if (uncompleted.length === 0) {
            pendingList.innerHTML = "<li>All tasks are complete! 🎉</li>";
        } else {
            uncompleted.forEach(t => {
                const li = document.createElement('li');
                li.textContent = t.text;
                pendingList.appendChild(li);
            });
        }
    }
}

// ==========================================
// 5. REMINDERS
// ==========================================
let reminders = [];

function addReminder() {
    const reminderInput = document.getElementById("reminderInput");
    const reminderTime = document.getElementById("reminderTime");

    if (!reminderInput || !reminderTime) return;

    const text = reminderInput.value.trim();
    const time = reminderTime.value;

    if (text === "") {
        reminderInput.focus();
        reminderInput.placeholder = "⚠️ Please enter a reminder!";
        return;
    }

    if (time === "") {
        reminderTime.focus();
        return;
    }

    reminders.push({ id: Date.now(), text: text, time: time });

    reminderInput.value = "";
    reminderTime.value = "";
    reminderInput.placeholder = "What should I remember?";

    displayReminders();
}

function displayReminders() {
    const reminderList = document.getElementById("reminderList");
    if (!reminderList) return;

    reminderList.innerHTML = "";

    reminders.forEach(reminder => {
        const li = document.createElement("li");
        li.className = "task";

        const reminderDate = new Date(reminder.time);

        li.innerHTML = `
            <div class="task-left">
                <span>
                    🔔 <strong>${escapeHTML(reminder.text)}</strong><br>
                    <small>${reminderDate.toLocaleString()}</small>
                </span>
            </div>
            <button
                type="button"
                class="delete-btn"
                onclick="deleteReminder(${reminder.id})">
                Delete
            </button>
        `;
        reminderList.appendChild(li);
    });
}

function deleteReminder(id) {
    reminders = reminders.filter(reminder => reminder.id !== id);
    displayReminders();
}

// ==========================================
// 6. BIRTHDAYS & EVENTS
// ==========================================
let events = [];

function addEvent() {
    const nameInput = document.getElementById("eventName");
    const dateInput = document.getElementById("eventDate");

    if (!nameInput || !dateInput) return;

    const name = nameInput.value.trim();
    const date = dateInput.value;

    if (!name) { nameInput.focus(); return; }
    if (!date) { dateInput.focus(); return; }

    events.push({ name: name, date: date });

    nameInput.value = "";
    dateInput.value = "";

    displayEvents();
}

function displayEvents() {
    const list = document.getElementById("eventList");
    if (!list) return;

    list.innerHTML = "";

    events.forEach((evt, index) => {
        const eventDate = new Date(evt.date + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const difference = eventDate.getTime() - today.getTime();
        const days = Math.ceil(difference / (1000 * 60 * 60 * 24));

        let message = days > 0 ? days + " days left" : (days === 0 ? "🎉 Today!" : "Event has passed");

        const card = document.createElement("div");
        card.className = "event-card";
        card.innerHTML = `
            <div>
                <strong>🎂 ${escapeHTML(evt.name)}</strong><br>
                <small>${eventDate.toDateString()}</small>
            </div>
            <div class="days-left">${message}</div>
            <button
                type="button"
                class="delete-btn"
                onclick="deleteEvent(${index})">
                Delete
            </button>
        `;
        list.appendChild(card);
    });
}

function deleteEvent(index) {
    if (!events[index]) return;
    events.splice(index, 1);
    displayEvents();
}

// ==========================================
// 7. STUDY & WORK TIMER
// ==========================================
let timer = null;
let totalTime = 25 * 60;
let timeLeft = 25 * 60;
let running = false;

function updateHourglass() {
    const topSand = document.getElementById("topSand");
    const bottomSand = document.getElementById("bottomSand");

    if (!topSand || !bottomSand) return;

    if (totalTime <= 0) {
        topSand.style.height = "0px";
        bottomSand.style.height = "62px";
        return;
    }

    const percentage = timeLeft / totalTime;
    topSand.style.height = Math.max(0, 62 * percentage) + "px";
    bottomSand.style.height = Math.max(8, 62 * (1 - percentage)) + "px";
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById("timerDisplay");
    if (!timerDisplay) return;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    timerDisplay.innerText = 
        String(minutes).padStart(2, "0") + ":" + 
        String(seconds).padStart(2, "0");
}

function startTimer() {
    if (running || timeLeft <= 0) return;

    running = true;
    const hourglass = document.getElementById("hourglass");
    if (hourglass) {
        hourglass.classList.remove("paused", "finished");
        hourglass.classList.add("running");
    }

    timer = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            updateTimerDisplay();
            updateHourglass();
        } else {
            pauseTimer();
            if (hourglass) {
                hourglass.classList.remove("running");
                hourglass.classList.add("finished");
            }
            alert("🎉 Session completed! Take a short break.");
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timer);
    timer = null;
    running = false;

    const hourglass = document.getElementById("hourglass");
    if (hourglass) {
        hourglass.classList.remove("running");
        hourglass.classList.add("paused");
    }
}

function resetTimer() {
    pauseTimer();

    const minutesInput = document.getElementById("timerMinutes");
    const minutes = minutesInput ? Number(minutesInput.value) : 25;

    totalTime = minutes * 60;
    timeLeft = totalTime;

    updateTimerDisplay();
    updateHourglass();

    const hourglass = document.getElementById("hourglass");
    if (hourglass) {
        hourglass.classList.remove("paused", "finished");
    }
}