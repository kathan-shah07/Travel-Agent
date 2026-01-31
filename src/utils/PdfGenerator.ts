
import PDFDocument from 'pdfkit';
import fs from 'fs';
import { Itinerary } from '../types';


export class PdfGenerator {

    public async generateItineraryPdf(itinerary: Itinerary, filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument();
            const stream = fs.createWriteStream(filePath);

            doc.pipe(stream);

            // Title
            doc.fillColor('#2c3e50').fontSize(28).text('Travel Itinerary', { align: 'center', underline: true });
            doc.moveDown(2);

            // Iterate through days
            itinerary.days.forEach((day, index) => {
                if (index > 0) doc.addPage();

                doc.fillColor('#e67e22').fontSize(22).text(`Day ${day.day}`, { underline: false });
                doc.moveDown(1);

                day.blocks.forEach(block => {
                    const time = block.time_of_day;
                    const name = block.poi_name || block.poi_id;
                    const duration = `${block.duration_min} mins`;

                    doc.fillColor('#2980b9').fontSize(16).text(`${time}: ${name}`);
                    doc.fillColor('#7f8c8d').fontSize(12).text(`  Duration: ${duration}`);

                    if (block.travel_time_min > 0) {
                        doc.fillColor('#27ae60').fontSize(11).text(`  → Travel: ${block.travel_time_min} mins (${block.travel_distance_km || 0} km)`);
                    }

                    doc.moveDown(1);
                });
            });

            doc.end();

            stream.on('finish', () => resolve(filePath));
            stream.on('error', (err) => reject(err));
        });
    }

    public async generateItineraryPdfBuffer(itinerary: Itinerary): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument();
            const chunks: Buffer[] = [];

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (err) => reject(err));

            // Title
            doc.fillColor('#2c3e50').fontSize(28).text('Travel Itinerary', { align: 'center', underline: true });
            doc.moveDown(2);

            // Iterate through days
            itinerary.days.forEach((day, index) => {
                if (index > 0) doc.addPage();

                doc.fillColor('#e67e22').fontSize(22).text(`Day ${day.day}`, { underline: false });
                doc.moveDown(1);

                day.blocks.forEach(block => {
                    const time = block.time_of_day;
                    const name = block.poi_name || block.poi_id;
                    const duration = `${block.duration_min} mins`;

                    doc.fillColor('#2980b9').fontSize(16).text(`${time}: ${name}`);
                    doc.fillColor('#7f8c8d').fontSize(12).text(`  Duration: ${duration}`);

                    if (block.travel_time_min > 0) {
                        doc.fillColor('#27ae60').fontSize(11).text(`  → Travel: ${block.travel_time_min} mins (${block.travel_distance_km || 0} km)`);
                    }

                    doc.moveDown(1);
                });
            });

            doc.end();
        });
    }
}
