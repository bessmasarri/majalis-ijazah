const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const generateQR = require('./qr');

const generateCertificate = async (attendeeName, sessionTitle, sheikhName, date, certificateId, outputPath) => {
    return new Promise(async (resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Fonts
        const fontPath = path.join(__dirname, '../public/fonts/Amiri-Regular.ttf');
        if (fs.existsSync(fontPath)) {
            doc.font(fontPath);
        } else {
            console.warn("Arabic font not found, using default.");
            doc.font('Helvetica');
        }

        // Decorative Border (simple rectangle)
        doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
            .stroke('#15803d') // Emerald-600
            .lineWidth(5);

        doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
            .stroke('#fcd34d') // Amber-300
            .lineWidth(2);

        // Header
        doc.fontSize(30).fillColor('#15803d').text('إجازة حضور مجلس علم', { align: 'center' });
        doc.moveDown();

        // Content
        doc.fontSize(20).fillColor('#000000').text(`نشهد بأن الطالب/ة:`, { align: 'center', features: ['rtla'] });
        doc.moveDown(0.5);

        doc.fontSize(25).fillColor('#b45309').text(attendeeName, { align: 'center', features: ['rtla'] }); // Amber-700
        doc.moveDown(0.5);

        doc.fontSize(20).fillColor('#000000').text(`قد حضر/ت مجلس:`, { align: 'center', features: ['rtla'] });
        doc.fontSize(22).fillColor('#15803d').text(sessionTitle, { align: 'center', features: ['rtla'] });

        doc.moveDown(0.5);
        doc.fontSize(20).fillColor('#000000').text(`تحت إشراف الشيخ: ${sheikhName}`, { align: 'center', features: ['rtla'] });
        doc.text(`بتاريخ: ${date}`, { align: 'center', features: ['rtla'] });

        doc.moveDown(2);

        // QR Code for verification
        const verifyUrl = `http://localhost:3000/verify/${certificateId}`; // TODO: Change base URL in prod
        const qrDataUrl = await generateQR(verifyUrl);

        doc.image(qrDataUrl, doc.page.width / 2 - 50, doc.y, { fit: [100, 100], align: 'center' });
        doc.moveDown(5); // Move down enough to clear image
        doc.fontSize(10).fillColor('#555555').text(`ID: ${certificateId}`, { align: 'center' });
        doc.text(`للتحقق من صحة هذه الإجازة، يرجى مسح الرمز أعلاه`, { align: 'center', features: ['rtla'] });

        doc.end();

        stream.on('finish', () => resolve(outputPath));
        stream.on('error', (err) => reject(err));
    });
};

module.exports = generateCertificate;
