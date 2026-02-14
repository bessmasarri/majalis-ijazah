const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } = require("docx");

// Function to generate a rich sample Word document (resembling the user's request)
const generateSampleDocx = async (outputPath) => {
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    // Header Area
                    new Paragraph({
                        text: "بسم الله الرحمن الرحيم",
                        alignment: AlignmentType.CENTER,
                        heading: HeadingLevel.HEADING_1,
                        bidirectional: true,
                    }),
                    new Paragraph({
                        text: "إجازة بالسند المتصل",
                        alignment: AlignmentType.CENTER,
                        heading: HeadingLevel.HEADING_2,
                        bidirectional: true,
                    }),
                    new Paragraph({ text: "", spacing: { after: 200 } }), // Spacer

                    // Main Text Body
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "الحمد لله والصلاة والسلام على رسول الله، وآله وصحبه أجمعين، أما بعد:",
                                size: 28, // 14pt
                                rightToLeft: true,
                            })
                        ],
                        alignment: AlignmentType.RIGHT,
                        bidirectional: true,
                    }),
                    new Paragraph({ text: "", spacing: { after: 100 } }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "فقد حضر مجلسنا العلمي هذا الطالب(ة) المجتهد(ة):",
                                size: 28,
                                rightToLeft: true,
                            })
                        ],
                        alignment: AlignmentType.RIGHT,
                        bidirectional: true,
                    }),

                    // Student Name Placeholder (Prominent)
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "{أسم}",
                                size: 48, // 24pt
                                bold: true,
                                color: "059669", // Emerald Green
                                rightToLeft: true,
                            })
                        ],
                        alignment: AlignmentType.CENTER,
                        bidirectional: true,
                        spacing: { before: 200, after: 200 },
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "وقد أتم سماع/قراءة المجلس بعنوان: {title}",
                                size: 28,
                                rightToLeft: true,
                            })
                        ],
                        alignment: AlignmentType.RIGHT,
                        bidirectional: true,
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "على شيخه: {sheikh_name}",
                                size: 28,
                                bold: true,
                                rightToLeft: true,
                            })
                        ],
                        alignment: AlignmentType.RIGHT,
                        bidirectional: true,
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "وذلك بتاريخ: {date}",
                                size: 24,
                                rightToLeft: true,
                            })
                        ],
                        alignment: AlignmentType.LEFT,
                        bidirectional: true,
                        spacing: { before: 400 },
                    }),

                    new Paragraph({
                        text: "_________________________",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: "توقيع الشيخ / الختم",
                        alignment: AlignmentType.CENTER,
                        bidirectional: true,
                    }),
                ],
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
};

// Function to fill a template with data
const fillTemplate = (inputPath, outputPath, data) => {
    try {
        const content = fs.readFileSync(inputPath, "binary");
        const zip = new PizZip(content);

        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        // Safe replace for missing keys
        doc.setData(data);

        doc.render();

        const buf = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
        });

        fs.writeFileSync(outputPath, buf);
    } catch (error) {
        console.error("DocxTemplate Error:", error);
        throw error;
    }
};

module.exports = { generateSampleDocx, fillTemplate };
