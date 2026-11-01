import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { mutateData, readData, nextId, isoNow } from '../../data/store.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { ensureCsrfToken } from '../../middleware/csrf.js';
import { conflict, HttpError } from '../../utils/http-error.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
const controlChars = /[\u0000-\u001F\u007F]/;
const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name (2–100 characters).').max(100, 'Enter your name (2–100 characters).').refine((value) => !controlChars.test(value), 'Name contains invalid characters.'),
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email address.'),
  password: z.string().min(12, 'Use at least 12 characters.').max(128, 'Password must be 128 characters or less.')
}).strict();
const loginSchema = z.object({ email: z.string().trim().toLowerCase().max(254).email(), password: z.string().min(1).max(128) }).strict();

router.get('/csrf', (req, res) => res.json({ success: true, data: { csrfToken: ensureCsrfToken(req) } }));

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await mutateData((data) => {
    if (data.users.some((candidate) => candidate.email.toLowerCase() === email)) {
      throw conflict('This email is already registered.', { email: 'This email is already registered.' });
    }
    const created = { id: nextId(data, 'users'), name, email, passwordHash, role: 'student' as const, createdAt: isoNow() };
    data.users.push(created);
    return created;
  });
  const { passwordHash: _passwordHash, createdAt, ...safe } = user;
  res.status(201).json({ success: true, data: { ...safe, created_at: createdAt }, message: 'Account created successfully' });
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  const user = (await readData()).users.find((candidate) => candidate.email.toLowerCase() === req.body.email);
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    const csrfToken = ensureCsrfToken(req);
    res.json({ success: true, data: { user: req.session.user, csrfToken }, message: 'Welcome back' });
  });
});

router.post('/logout', requireAuth, (req, res, next) => req.session.destroy((error) => error ? next(error) : res.status(204).end()));
router.get('/me', requireAuth, (req, res) => res.json({ success: true, data: { user: req.session.user, csrfToken: ensureCsrfToken(req) } }));

export default router;
