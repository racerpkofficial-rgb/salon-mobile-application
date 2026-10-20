import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
export async function seedSuperAdmin() { if (!env.SUPER_ADMIN_EMAIL || !env.SUPER_ADMIN_PASSWORD) return; const email = env.SUPER_ADMIN_EMAIL.toLowerCase(); if (await User.exists({ email })) return; await User.create({ name: env.SUPER_ADMIN_NAME || 'Platform Admin', email, passwordHash: await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, 12), role: 'SUPER_ADMIN' }); console.log('Seeded configured super admin'); }