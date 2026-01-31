
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export class EmailService {
    private transporter;

    constructor() {
        // Configure transport based on env vars
        // For testing, we might default to a mock or ethereal if no real creds provided
        this.transporter = nodemailer.createTransport({
            service: 'gmail', // Simplest for demo, ideally configurable
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    public async sendItineraryEmail(toEmail: string, pdfPath: string): Promise<boolean> {
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
