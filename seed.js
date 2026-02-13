const db = require('./database');
const moment = require('moment');
const bcrypt = require('bcryptjs');

const today = moment().format('YYYY-MM-DD');
const startTime = moment().subtract(1, 'hour').format('HH:mm');
const endTime = moment().add(4, 'hours').format('HH:mm');

const seedData = async () => {
    const hashedPassword = await bcrypt.hash('123456', 10);

    db.serialize(() => {
        // Create User
        db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
            ["الشيخ محمد", "sheikh@example.com", hashedPassword],
            function (err) {
                if (err) return console.error(err);

                const userId = this.lastID;
                console.log(`Created User ID: ${userId} (Email: sheikh@example.com, Pass: 123456)`);

                // Create Session
                db.run(`INSERT INTO sessions (user_id, title, sheikh_name, date, start_time, end_time, description) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [userId, "مجلس شرح الأربعين النووية", "الشيخ محمد", today, startTime, endTime, "تجربة مجلس علمي."],
                    function (err) {
                        if (err) console.error(err);
                        else console.log(`Created Session ID: ${this.lastID}`);
                    }
                );
            }
        );
    });
};

seedData();
