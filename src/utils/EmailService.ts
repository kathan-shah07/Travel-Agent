
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export class EmailService {
    private transporter;

    constructor() {
        // Configure transport based on env vars
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, // Use SSL
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            connectionTimeout: 10000, // 10 seconds
            greetingTimeout: 10000,
            socketTimeout: 20000
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
