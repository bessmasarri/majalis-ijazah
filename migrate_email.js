const sqlite3 = require('sqlite3').verbose();
const dbStr = 'database.sqlite';
const db = new sqlite3.Database(dbStr);

db.serialize(() => {
    console.log("Checking for email column in attendees...");
    db.run("ALTER TABLE attendees ADD COLUMN email TEXT", (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("Column 'email' already exists.");
            } else {
                console.error("Error adding column:", err.message);
            }
        } else {
            console.log("Column 'email' added successfully.");
        }
    });
});

db.close();
