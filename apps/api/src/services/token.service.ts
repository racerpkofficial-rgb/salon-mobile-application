import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { JwtPayload } from '../types/auth.js';
export const issueToken = (payload: JwtPayload) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d', issuer: 'aurelia-api', audience: 'aurelia-mobile' });
export const verifyToken = (token: string) => jwt.verify(token, env.JWT_SECRET, { issuer: 'aurelia-api', audience: 'aurelia-mobile' }) as JwtPayload;