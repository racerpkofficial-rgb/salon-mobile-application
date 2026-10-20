import mongoose from 'mongoose';
import { Salon } from './models/Salon.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aurelia');
  const salons = await Salon.find({}, 'salonName status subscriptionStatus city location').lean();
  console.log('--- FOUND SALONS ---');
  console.log(JSON.stringify(salons, null, 2));
  await mongoose.disconnect();
}

main().catch(console.error);
