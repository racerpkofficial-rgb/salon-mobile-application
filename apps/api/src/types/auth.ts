export const roles = ['CUSTOMER', 'SALON_OWNER', 'SUPER_ADMIN'] as const;
export type Role = (typeof roles)[number];
export type JwtPayload = { sub: string; role: Role };
