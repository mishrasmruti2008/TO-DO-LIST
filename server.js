const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const db = new sqlite3.Database('./planner.db');

// Initialize database tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, completed BOOLEAN)`);
    db.run(`CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, time TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, date TEXT)`);
});

// --- TASKS ENDPOINTS ---
app.get('/api/tasks', (req, res) => {
    db.all('SELECT * FROM tasks', [], (err, rows) => res.json(rows || []));
});

app.post('/api/tasks', (req, res) => {
    const { text } = req.body;
    db.run('INSERT INTO tasks (text, completed) VALUES (?, 0)', [text], function() {
        res.json({ id: this.lastID, text, completed: false });
    });
});

app.put('/api/tasks/:id', (req, res) => {
    const { completed } = req.body;
    db.run('UPDATE tasks SET completed = ? WHERE id = ?', [completed ? 1 : 0, req.params.id], () => {
        res.json({ updated: true });
    });
});

app.delete('/api/tasks/:id', (req, res) => {
    db.run('DELETE FROM tasks WHERE id = ?', [req.params.id], () => res.json({ deleted: true }));
});

// --- REMINDERS ENDPOINTS ---
app.get('/api/reminders', (req, res) => {
    db.all('SELECT * FROM reminders', [], (err, rows) => res.json(rows || []));
});

app.post('/api/reminders', (req, res) => {
    const { text, time } = req.body;
    db.run('INSERT INTO reminders (text, time) VALUES (?, ?)', [text, time], function() {
        res.json({ id: this.lastID, text, time });
    });
});

app.delete('/api/reminders/:id', (req, res) => {
    db.run('DELETE FROM reminders WHERE id = ?', [req.params.id], () => res.json({ deleted: true }));
});

// --- EVENTS ENDPOINTS ---
app.get('/api/events', (req, res) => {
    db.all('SELECT * FROM events', [], (err, rows) => res.json(rows || []));
});

app.post('/api/events', (req, res) => {
    const { name, date } = req.body;
    db.run('INSERT INTO events (name, date) VALUES (?, ?)', [name, date], function() {
        res.json({ id: this.lastID, name, date });
    });
});

app.delete('/api/events/:index', (req, res) => {
    // Note: For events, delete by name/date or migrate array index to ID
    db.run('DELETE FROM events WHERE rowid = ?', [Number(req.params.index) + 1], () => res.json({ deleted: true }));
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));