
import { startServer } from './api/server';
import dotenv from 'dotenv';

dotenv.config();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

const PORT = 3000;
startServer(PORT);
