const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');
const moment = require('moment');
const generateQR = require('./utils/qr');
const generateCertificate = require('./utils/pdf');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/certificates', express.static(path.join(__dirname, 'certificates')));

// View Engine Setup
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// Ensure certificates directory exists
if (!fs.existsSync(path.join(__dirname, 'certificates'))) {
    fs.mkdirSync(path.join(__dirname, 'certificates'));
}

// --- Routes ---

// Home - Admin Dashboard
app.get('/', (req, res) => {
    const sql = `SELECT * FROM sessions ORDER BY date DESC, start_time DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return console.error(err.message);
        res.render('index', { sessions: rows });
    });
});

// Create Session Page
app.get('/create-session', (req, res) => {
    res.render('create_session');
});

// Create Session Logic
app.post('/api/sessions', (req, res) => {
    const { title, sheikh_name, date, start_time, end_time, description } = req.body;
    const sql = `INSERT INTO sessions (title, sheikh_name, date, start_time, end_time, description) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [title, sheikh_name, date, start_time, end_time, description], function (err) {
        if (err) return console.error(err.message);
        res.redirect('/');
    });
});

// View Session
app.get('/session/:id', (req, res) => {
    const sessionId = req.params.id;
    const sqlSession = `SELECT * FROM sessions WHERE id = ?`;
    const sqlAttendees = `SELECT * FROM attendees WHERE session_id = ? ORDER BY created_at DESC`;

    db.get(sqlSession, [sessionId], async (err, session) => {
        if (err || !session) return res.status(404).send("Session not found");

        db.all(sqlAttendees, [sessionId], async (err, attendees) => {
            if (err) return console.error(err.message);

            const now = moment();
            const sessionStart = moment(`${session.date} ${session.start_time}`, 'YYYY-MM-DD HH:mm');
            const sessionEnd = moment(`${session.date} ${session.end_time}`, 'YYYY-MM-DD HH:mm');
            const isActive = now.isBetween(sessionStart, sessionEnd);

            // Generate QR Code for Registration URL
            const registerUrl = `${BASE_URL}/register/${session.id}`;
            const qrCodeDataUrl = await generateQR(registerUrl);

            res.render('session', { session, attendees, isActive, qrCodeDataUrl });
        });
    });
});

// Registration Page (GET)
app.get('/register/:id', (req, res) => {
    const sessionId = req.params.id;
    const sqlSession = `SELECT * FROM sessions WHERE id = ?`;

    db.get(sqlSession, [sessionId], (err, session) => {
        if (err || !session) return res.status(404).send("Session not found");

        const now = moment();
        const sessionStart = moment(`${session.date} ${session.start_time}`, 'YYYY-MM-DD HH:mm');
        const sessionEnd = moment(`${session.date} ${session.end_time}`, 'YYYY-MM-DD HH:mm');

        let hideForm = false;
        let error = null;

        if (!now.isBetween(sessionStart, sessionEnd)) {
            hideForm = true;
            error = "عذراً، انتهت فترة تسجيل الحضور لهذا المجلس.";
        }

        res.render('register', { session, hideForm, error, success: false });
    });
});

// Handle Registration (POST)
app.post('/api/register', (req, res) => {
    const { session_id, name } = req.body;

    // Validate Time Again
    const sqlSession = `SELECT * FROM sessions WHERE id = ?`;
    db.get(sqlSession, [session_id], (err, session) => {
        if (err || !session) return res.status(404).send("Session not found");

        const now = moment();
        const sessionStart = moment(`${session.date} ${session.start_time}`, 'YYYY-MM-DD HH:mm');
        const sessionEnd = moment(`${session.date} ${session.end_time}`, 'YYYY-MM-DD HH:mm');

        if (!now.isBetween(sessionStart, sessionEnd)) {
            return res.render('register', { session, hideForm: true, error: "عذراً، انتهى وقت التسجيل.", success: false });
        }

        const sqlInsert = `INSERT INTO attendees (session_id, name) VALUES (?, ?)`;
        db.run(sqlInsert, [session_id, name], function (err) {
            if (err) return console.error(err.message);
            res.render('register', { session, hideForm: true, error: null, success: true });
        });
    });
});

// Generate Certificates (Admin)
app.post('/api/certificates/generate', (req, res) => {
    const { session_id } = req.body;
    const sqlSession = `SELECT * FROM sessions WHERE id = ?`;

    db.get(sqlSession, [session_id], (err, session) => {
        if (err || !session) return res.status(404).send("Session not found");

        const sqlAttendees = `SELECT * FROM attendees WHERE session_id = ?`;
        db.all(sqlAttendees, [session_id], async (err, attendees) => {
            if (err) return console.error(err.message);

            console.log(`Generating ${attendees.length} certificates for Session ${session.title}...`);

            for (const attendee of attendees) {
                // Check if cert already exists
                const checkCert = `SELECT id FROM certificates WHERE session_id = ? AND attendee_id = ?`;

                // Wrap in promise to await inside loop (simple way)
                await new Promise((resolve) => {
                    db.get(checkCert, [session_id, attendee.id], async (err, row) => {
                        let certId;
                        if (row) {
                            certId = row.id;
                        } else {
                            // Generate new ID
                            certId = crypto.randomBytes(8).toString('hex');
                            db.run(`INSERT INTO certificates (id, session_id, attendee_id) VALUES (?, ?, ?)`,
                                [certId, session_id, attendee.id]);
                        }

                        // Generate PDF
                        const fileName = `cert_${certId}.pdf`;
                        const outputPath = path.join(__dirname, 'certificates', fileName);

                        try {
                            await generateCertificate(
                                attendee.name,
                                session.title,
                                session.sheikh_name,
                                session.date,
                                certId,
                                outputPath
                            );
                            console.log(`Generated: ${outputPath}`);
                        } catch (e) {
                            console.error(`Error generating PDF for ${attendee.name}:`, e);
                        }
                        resolve();
                    });
                });
            }
            // Redirect back to session page
            res.redirect(`/session/${session_id}`);
        });
    });
});

// Verify Certificate
app.get('/verify/:id', (req, res) => {
    const certId = req.params.id;
    const sql = `
        SELECT c.id, c.generated_at, s.title as session_title, s.sheikh_name, s.date, a.name as student_name 
        FROM certificates c
        JOIN sessions s ON c.session_id = s.id
        JOIN attendees a ON c.attendee_id = a.id
        WHERE c.id = ?
    `;

    db.get(sql, [certId], (err, row) => {
        if (err) return console.error(err.message);

        if (row) {
            res.render('verify', { valid: true, certificate: row });
        } else {
            res.render('verify', { valid: false });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
