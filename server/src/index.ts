import app from './app.js';
import { connectDatabase } from './db.js';
import { config } from './config.js';

void connectDatabase().then(()=>app.listen(config.PORT,()=>console.info(`API listening on ${config.PORT}`))).catch(error=>{console.error('Database connection failed',error instanceof Error?error.message:'unknown');process.exit(1)});
