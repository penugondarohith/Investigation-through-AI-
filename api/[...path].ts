import type { IncomingMessage, ServerResponse } from 'node:http';
import { waitUntil } from '@vercel/functions';
import app from '../server/src/app.js';

app.locals.waitUntil=waitUntil;

export default function handler(req:IncomingMessage,res:ServerResponse){
 const url=req.url??'/';if(!url.startsWith('/api/'))req.url=`/api${url.startsWith('/')?url:`/${url}`}`;
 app(req as any,res as any);
}
