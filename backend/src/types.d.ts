import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: { id: number; name: string; email: string; role: 'student' | 'admin' };
    csrfToken?: string;
  }
}

declare global {
  namespace Express {
    interface Request { requestId: string; }
  }
}

export {};
