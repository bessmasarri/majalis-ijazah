const nodemailer = require('nodemailer');
const path = require('path');

// Configure this with real credentials if available
const transporter = nodemailer.createTransport({
    // Example for Gmail (requires App Password)
    // service: 'gmail',
    // auth: {
    //     user: 'your-email@gmail.com',
    //     pass: 'your-app-password'
    // }
    host: "smtp.ethereal.email", // Placeholder
    port: 587,
    secure: false, // true for 465, false for other ports
});

const sendIjazahEmail = async (toEmail, studentName, sessionTitle, filePath) => {
    if (!toEmail) return;

    const mailOptions = {
        from: '"Majalis Ijazah" <no-reply@majalis.com>',
        to: toEmail,
        subject: `إجازة مجلس: ${sessionTitle}`,
        text: `السلام عليكم ${studentName}،\n\nمرفق لكم إجازة حضور المجلس العلمي: ${sessionTitle}.\n\nتقبل الله منا ومنكم.`,
        attachments: [
            {
                filename: path.basename(filePath),
                path: filePath
            }
        ]
    };

    try {
        // In a real app with configured transport, this sends the email
        // await transporter.sendMail(mailOptions);
        console.log(`[SIMULATION] Email Sent to ${toEmail} with attachment ${filePath}`);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};

module.exports = { sendIjazahEmail };
