import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
const schema = z.object({ NODE_ENV: z.enum(['development','test','production']).default('development'), PORT: z.coerce.number().int().positive().default(5000), CLIENT_URL: z.string().url().default('http://localhost:5173'), MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'), GEMINI_API_KEY: z.string().optional().default(''), GEMINI_MODEL: z.string().default('gemini-2.5-flash'), VERDICT_MIN_REASONING_CHARS:z.coerce.number().int().min(20).max(1000).default(60), SESSION_SECRET: z.string().min(24, 'SESSION_SECRET must be at least 24 characters') });
export const config = schema.parse(process.env);
