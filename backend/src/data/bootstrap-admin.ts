import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { isoNow, mutateData, nextId } from './store.js';

const input = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128)
}).parse({ email: process.env.ADMIN_EMAIL, name: process.env.ADMIN_NAME, password: process.env.ADMIN_PASSWORD });
const passwordHash = await bcrypt.hash(input.password, 12);
await mutateData((data) => {
  const existing = data.users.find((user) => user.email.toLowerCase() === input.email);
  if (existing) Object.assign(existing, { name: input.name, passwordHash, role: 'admin' as const });
  else data.users.push({ id: nextId(data, 'users'), name: input.name, email: input.email, passwordHash, role: 'admin', createdAt: isoNow() });
});
console.log(`Admin account provisioned for ${input.email}. Password was not logged.`);
