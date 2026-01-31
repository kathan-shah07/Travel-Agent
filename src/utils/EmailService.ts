
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export class EmailService {
    private transporter;

    constructor() {
        // Configure transport based on env vars
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            connectionTimeout: 30000, // 30 seconds
            greetingTimeout: 30000,
            socketTimeout: 30000,
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    public async sendItineraryEmail(toEmail: string, pdfPath: string): Promise<boolean> {
        // Check if running on Render (which blocks SMTP on free tier)
        const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME;

        if (isRender) {
            console.warn("[Email] Running on Render - SMTP is blocked on free tier. Skipping email.");
            return false;
        }

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn("Email credentials missing. Skipping email send.");
            return false;
        }

        try {
            const info = await this.transporter.sendMail({
                from: '"Travel Agent AI" <' + process.env.EMAIL_USER + '>',
                to: toEmail,
                subject: 'Your Travel Itinerary',
                text: 'Please find attached your personalized travel itinerary.',
                attachments: [
                    {
                        filename: 'itinerary.pdf',
                        path: pdfPath
                    }
                ]
            });
            console.log("Email sent: %s", info.messageId);
            return true;
        } catch (error) {
            console.error("Error sending email:", error);
            return false;
        }
    }
}
