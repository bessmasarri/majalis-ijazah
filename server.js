const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');
const moment = require('moment');
const generateQR = require('./utils/qr');
const generateCertificate = require('./utils/pdf');
const crypto = require('crypto');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/certificates', express.static(path.join(__dirname, 'certificates')));

// Session Setup
app.use(session({
    secret: 'secret-key-change-this-in-prod', // In production use a strong env var
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// View Engine Setup
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// Global User Middleware
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Ensure certificates directory exists
if (!fs.existsSync(path.join(__dirname, 'certificates'))) {
    fs.mkdirSync(path.join(__dirname, 'certificates'));
}

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
};

// --- Routes ---

// Home - Public Landing Page
app.get('/', (req, res) => {
    // Only show recent public sessions or just a landing page?
    // Let's show recent sessions to everyone
    const sql = `SELECT * FROM sessions ORDER BY date DESC, start_time DESC LIMIT 6`;
    db.all(sql, [], (err, rows) => {
        if (err) return console.error(err.message);
        res.render('index', { sessions: rows });
    });
});

// --- Auth Routes ---

app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
});

app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;

        db.run(sql, [name, email, hashedPassword], function (err) {
            if (err) {
                console.error(err.message);
                return res.render('signup', { error: "البريد الإلكتروني مسجل بالفعل." });
            }
            // Auto login
            req.session.user = { id: this.lastID, name: name, email: email };
            res.redirect('/dashboard');
        });
    } catch (e) {
        console.error(e);
        res.render('signup', { error: "حدث خطأ أثناء التسجيل." });
    }
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = `SELECT * FROM users WHERE email = ?`;

    db.get(sql, [email], async (err, user) => {
        if (err || !user) {
            return res.render('login', { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
        }

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = { id: user.id, name: user.name, email: user.email };
            res.redirect('/dashboard');
        } else {
            res.render('login', { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/dashboard', isAuthenticated, (req, res) => {
    const sql = `SELECT * FROM sessions WHERE user_id = ? ORDER BY date DESC, start_time DESC`;
    db.all(sql, [req.session.user.id], (err, rows) => {
        if (err) return console.error(err.message);
        res.render('dashboard', { sessions: rows });
    });
});

// --- protected Session Routes ---

// Create Session Page
app.get('/create-session', isAuthenticated, (req, res) => {
    res.render('create_session');
});

// Create Session Logic
app.post('/api/sessions', isAuthenticated, (req, res) => {
    const { title, sheikh_name, date, start_time, end_time, description } = req.body;
    const user_id = req.session.user.id;

    const sql = `INSERT INTO sessions (user_id, title, sheikh_name, date, start_time, end_time, description) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [user_id, title, sheikh_name, date, start_time, end_time, description], function (err) {
        if (err) return console.error(err.message);
        res.redirect(`/session/${this.lastID}`);
    });
});

// View Session (Public or Private details?)
// Session page acts as "Manage" for admin and "View Info" for public.
// We need to hide "Manage" buttons if not the owner.
app.get('/session/:id', (req, res) => {
    const sessionId = req.params.id;
    const sqlSession = `SELECT * FROM sessions WHERE id = ?`;
    const sqlAttendees = `SELECT * FROM attendees WHERE session_id = ? ORDER BY created_at DESC`;

    db.get(sqlSession, [sessionId], async (err, session) => {
        if (err || !session) return res.status(404).send("Session not found");

        const isOwner = req.session.user && req.session.user.id === session.user_id;

        db.all(sqlAttendees, [sessionId], async (err, attendees) => {
            if (err) return console.error(err.message);

            const now = moment();
            const sessionStart = moment(`${session.date} ${session.start_time}`, 'YYYY-MM-DD HH:mm');
            const sessionEnd = moment(`${session.date} ${session.end_time}`, 'YYYY-MM-DD HH:mm');
            const isActive = now.isBetween(sessionStart, sessionEnd);

            const registerUrl = `${BASE_URL}/register/${session.id}`;
            const qrCodeDataUrl = await generateQR(registerUrl);

            res.render('session', { session, attendees, isActive, qrCodeDataUrl, isOwner });
        });
    });
});

// --- Public Routes ---

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

// Generate Certificates (Admin Only - Protected)
app.post('/api/certificates/generate', isAuthenticated, (req, res) => {
    const { session_id } = req.body;
    const sqlSession = `SELECT * FROM sessions WHERE id = ?`;

    db.get(sqlSession, [session_id], (err, session) => {
        if (err || !session) return res.status(404).send("Session not found");

        // Ensure user owns this session
        if (session.user_id !== req.session.user.id) {
            return res.status(403).send("Unauthorized");
        }

        const sqlAttendees = `SELECT * FROM attendees WHERE session_id = ?`;
        db.all(sqlAttendees, [session_id], async (err, attendees) => {
            if (err) return console.error(err.message);

            for (const attendee of attendees) {
                const checkCert = `SELECT id FROM certificates WHERE session_id = ? AND attendee_id = ?`;

                await new Promise((resolve) => {
                    db.get(checkCert, [session_id, attendee.id], async (err, row) => {
                        let certId;
                        if (row) {
                            certId = row.id;
                        } else {
                            certId = crypto.randomBytes(8).toString('hex');
                            db.run(`INSERT INTO certificates (id, session_id, attendee_id) VALUES (?, ?, ?)`,
                                [certId, session_id, attendee.id]);
                        }

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
                        } catch (e) {
                            console.error(`Error generating PDF for ${attendee.name}:`, e);
                        }
                        resolve();
                    });
                });
            }
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
