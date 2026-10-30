import mongoose from 'mongoose';
import { config } from './config.js';
let connectionPromise:Promise<typeof mongoose>|undefined;
export async function connectDatabase() {if(mongoose.connection.readyState===1)return mongoose;if(!connectionPromise)connectionPromise=mongoose.connect(config.MONGODB_URI,{serverSelectionTimeoutMS:10000}).then(connection=>{console.info('MongoDB connected');return connection}).catch(error=>{connectionPromise=undefined;throw error});return connectionPromise;}
