const sqlite3 = require('sqlite3').verbose();
const dbStr = 'database.sqlite';
const db = new sqlite3.Database(dbStr);

db.serialize(() => {
    console.log("Checking for ijazah_file column...");
    db.run("ALTER TABLE sessions ADD COLUMN ijazah_file TEXT", (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("Column 'ijazah_file' already exists.");
            } else {
                console.error("Error adding column:", err.message);
            }
        } else {
            console.log("Column 'ijazah_file' added successfully.");
        }
    });
});

db.close();
