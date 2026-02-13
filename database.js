const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database ' + dbPath + ': ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            // Sessions table
            db.run(`CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                sheikh_name TEXT NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                description TEXT
            )`);

            // Attendees table
            db.run(`CREATE TABLE IF NOT EXISTS attendees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )`);

            // Certificates table
            db.run(`CREATE TABLE IF NOT EXISTS certificates (
                id TEXT PRIMARY KEY,
                session_id INTEGER NOT NULL,
                attendee_id INTEGER NOT NULL,
                generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id),
                FOREIGN KEY (attendee_id) REFERENCES attendees(id)
            )`);
        });
    }
});

module.exports = db;
