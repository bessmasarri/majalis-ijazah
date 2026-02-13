const db = require('./database');
const moment = require('moment');

const today = moment().format('YYYY-MM-DD');
const startTime = moment().subtract(1, 'hour').format('HH:mm'); // Started 1 hour ago
const endTime = moment().add(2, 'hours').format('HH:mm'); // Ends in 2 hours

const sql = `INSERT INTO sessions (title, sheikh_name, date, start_time, end_time, description) VALUES (?, ?, ?, ?, ?, ?)`;

db.serialize(() => {
    db.run(sql, [
        "شرح الأربعين النووية - المجلس الأول",
        "الشيخ محمد بن صالح",
        today,
        startTime,
        endTime,
        "مجلس لشرح الأحاديث الخمسة الأولى من الأربعين النووية."
    ], function (err) {
        if (err) {
            console.error(err.message);
        } else {
            console.log(`Seeded session with ID: ${this.lastID}`);
        }
    });
});
