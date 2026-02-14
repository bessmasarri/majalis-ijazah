const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');
const moment = require('moment');
const generateQR = require('./utils/qr');
const generateCertificate = require('./utils/pdf');
const { generateSampleDocx, fillTemplate } = require('./utils/word');
const { sendIjazahEmail } = require('./utils/email');
const crypto = require('crypto');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/certificates', express.static(path.join(__dirname, 'certificates')));

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/msword' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            cb(null, true);
        } else {
            cb(new Error('Only .doc and .docx files are allowed!'), false);
        }
    }
});

// Session Setup
app.use(session({
    secret: 'secret-key-change-this-in-prod',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
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

app.get('/', (req, res) => {
    const sql = `SELECT * FROM sessions ORDER BY date DESC, start_time DESC LIMIT 6`;
    db.all(sql, [], (err, rows) => {
        if (err) return console.error(err.message);
        res.render('index', { sessions: rows });
    });
});

// --- Auth Routes ---
app.get('/signup', (req, res) => { res.render('signup', { error: null }); });

app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;
        db.run(sql, [name, email, hashedPassword], function (err) {
            if (err) return res.render('signup', { error: "البريد الإلكتروني مسجل بالفعل." });
            req.session.user = { id: this.lastID, name: name, email: email };
            res.redirect('/dashboard');
        });
    } catch (e) { res.render('signup', { error: "حدث خطأ أثناء التسجيل." }); }
});

app.get('/login', (req, res) => { res.render('login', { error: null }); });

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], async (err, user) => {
        if (err || !user) return res.render('login', { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = { id: user.id, name: user.name, email: user.email };
            res.redirect('/dashboard');
        } else {
            res.render('login', { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
        }
    });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

app.get('/dashboard', isAuthenticated, (req, res) => {
    const sql = `SELECT * FROM sessions WHERE user_id = ? ORDER BY date DESC, start_time DESC`;
    db.all(sql, [req.session.user.id], (err, rows) => {
        if (err) return console.error(err.message);
        res.render('dashboard', { sessions: rows });
    });
});

// --- protected Session Routes ---
app.get('/create-session', isAuthenticated, (req, res) => { res.render('create_session'); });

app.post('/api/sessions', isAuthenticated, upload.single('ijazah_file'), (req, res) => {
    const { title, sheikh_name, date, start_time, end_time, description } = req.body;
    const user_id = req.session.user.id;
    const ijazah_file = req.file ? req.file.filename : null;

    const sql = `INSERT INTO sessions (user_id, title, sheikh_name, date, start_time, end_time, description, ijazah_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [user_id, title, sheikh_name, date, start_time, end_time, description, ijazah_file], function (err) {
        if (err) return console.error(err.message);
        res.redirect(`/session/${this.lastID}`);
    });
});

app.post('/api/sessions/delete/:id', isAuthenticated, (req, res) => {
    const sessionId = req.params.id;
    const userId = req.session.user.id;
    db.get(`SELECT * FROM sessions WHERE id = ?`, [sessionId], (err, session) => {
        if (err || !session || session.user_id !== userId) return res.status(403).send("Unauthorized");
        if (session.ijazah_file) {
            const filePath = path.join(__dirname, 'public/uploads', session.ijazah_file);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        db.run(`DELETE FROM sessions WHERE id = ?`, [sessionId], (err) => {
            res.redirect('/dashboard');
        });
    });
});

app.get('/session/edit/:id', isAuthenticated, (req, res) => {
    const sessionId = req.params.id;
    const userId = req.session.user.id;
    db.get(`SELECT * FROM sessions WHERE id = ?`, [sessionId], (err, session) => {
        if (err || !session || session.user_id !== userId) return res.redirect('/dashboard');
        res.render('edit_session', { session });
    });
});

app.post('/api/sessions/update/:id', isAuthenticated, upload.single('ijazah_file'), (req, res) => {
    const sessionId = req.params.id;
    const userId = req.session.user.id;
    const { title, sheikh_name, date, start_time, end_time, description } = req.body;

    db.get(`SELECT * FROM sessions WHERE id = ?`, [sessionId], (err, session) => {
        if (err || !session) return res.status(404).send("Session not found");
        if (session.user_id !== userId) return res.status(403).send("Unauthorized");

        let ijazah_file = session.ijazah_file;
        if (req.file) {
            if (ijazah_file) {
                const oldPath = path.join(__dirname, 'public/uploads', ijazah_file);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            ijazah_file = req.file.filename;
        }

        const sql = `UPDATE sessions SET title = ?, sheikh_name = ?, date = ?, start_time = ?, end_time = ?, description = ?, ijazah_file = ? WHERE id = ?`;
        db.run(sql, [title, sheikh_name, date, start_time, end_time, description, ijazah_file, sessionId], function (err) {
            if (err) return console.error(err.message);
            res.redirect(`/session/${sessionId}`);
        });
    });
});

// --- Template Routes ---
app.get('/api/template/sample', (req, res) => {
    const outputPath = path.join(__dirname, 'public/uploads', 'sample_ijazah.docx');
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    generateSampleDocx(outputPath).then(() => {
        res.download(outputPath, 'نموذج_إجازة.docx');
    }).catch(err => {
        console.error(err);
        res.status(500).send("Error generating sample");
    });
});

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

app.get('/register/:id', (req, res) => {
    const sessionId = req.params.id;
    db.get(`SELECT * FROM sessions WHERE id = ?`, [sessionId], (err, session) => {
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

app.post('/api/register', (req, res) => {
    const { session_id, name, email } = req.body;
    db.get(`SELECT * FROM sessions WHERE id = ?`, [session_id], (err, session) => {
        if (err || !session) return res.status(404).send("Session not found");
        const now = moment();
        const sessionStart = moment(`${session.date} ${session.start_time}`, 'YYYY-MM-DD HH:mm');
        const sessionEnd = moment(`${session.date} ${session.end_time}`, 'YYYY-MM-DD HH:mm');
        if (!now.isBetween(sessionStart, sessionEnd)) return res.render('register', { session, hideForm: true, error: "عذراً، انتهى وقت التسجيل.", success: false });

        db.run(`INSERT INTO attendees (session_id, name, email) VALUES (?, ?, ?)`, [session_id, name, email], function (err) {
            res.render('register', { session, hideForm: true, error: null, success: true });
        });
    });
});

// Manual Add Attendee
app.post('/api/attendees/add', isAuthenticated, (req, res) => {
    const { session_id, name, email } = req.body;
    const user_id = req.session.user.id;

    db.get(`SELECT * FROM sessions WHERE id = ?`, [session_id], (err, session) => {
        if (err || !session) return res.status(404).send("Session not found");
        if (session.user_id !== user_id) return res.status(403).send("Unauthorized");

        db.run(`INSERT INTO attendees (session_id, name, email) VALUES (?, ?, ?)`, [session_id, name, email], function (err) {
            res.redirect(`/session/${session_id}`);
        });
    });
});

app.post('/api/certificates/generate', isAuthenticated, (req, res) => {
    const { session_id } = req.body;
    db.get(`SELECT * FROM sessions WHERE id = ?`, [session_id], (err, session) => {
        if (err || !session) return res.status(404).send("Session not found");
        if (session.user_id !== req.session.user.id) return res.status(403).send("Unauthorized");

        db.all(`SELECT * FROM attendees WHERE session_id = ?`, [session_id], async (err, attendees) => {
            if (err) return console.error(err.message);

            for (const attendee of attendees) {
                const checkCert = `SELECT id FROM certificates WHERE session_id = ? AND attendee_id = ?`;
                await new Promise((resolve) => {
                    db.get(checkCert, [session_id, attendee.id], async (err, row) => {
                        let certId = row ? row.id : crypto.randomBytes(8).toString('hex');
                        if (!row) {
                            db.run(`INSERT INTO certificates (id, session_id, attendee_id) VALUES (?, ?, ?)`, [certId, session_id, attendee.id]);
                        }

                        let outputPath;
                        if (session.ijazah_file) {
                            // --- Word Generator ---
                            const templatePath = path.join(__dirname, 'public/uploads', session.ijazah_file);
                            const fileName = `cert_${certId}.docx`;
                            outputPath = path.join(__dirname, 'certificates', fileName);

                            if (fs.existsSync(templatePath)) {
                                const data = {
                                    name: attendee.name,
                                    date: session.date,
                                    title: session.title,
                                    sheikh_name: session.sheikh_name,
                                    'أسم': attendee.name
                                };
                                try {
                                    fillTemplate(templatePath, outputPath, data);
                                } catch (e) { console.error("Word Generation Error", e); }
                            }
                        } else {
                            // --- PDF Fallback ---
                            const fileName = `cert_${certId}.pdf`;
                            outputPath = path.join(__dirname, 'certificates', fileName);
                            try {
                                await generateCertificate(attendee.name, session.title, session.sheikh_name, session.date, certId, outputPath);
                            } catch (e) { console.error("PDF Generation Error", e); }
                        }

                        // Send Email if exists
                        if (attendee.email && outputPath && fs.existsSync(outputPath)) {
                            await sendIjazahEmail(attendee.email, attendee.name, session.title, outputPath);
                        }

                        resolve();
                    });
                });
            }
            res.redirect(`/session/${session_id}`);
        });
    });
});

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
