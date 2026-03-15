import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'path';

import loginRouter from './routes/loginRouter';
import authServiceRouter from './routes/authServiceRouter';
import freeSchoolRouter from './routes/freeSchoolRouter';
import migrationRouter from './routes/migrationRouter';

const app = express();
const PORT = process.env.PORT ?? 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  }),
);

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

app.use('/api', loginRouter);
app.use('/api/auth-service', authServiceRouter);
app.use('/api/freeschool', freeSchoolRouter);
app.use('/api/migration', migrationRouter);

// ---------------------------------------------------------------------------
// Static Frontend
// ---------------------------------------------------------------------------

const PUBLIC = path.join(__dirname, 'public');
app.use(express.static(PUBLIC));

// All non-API routes → SPA
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Admin Client running on port ${PORT}`);
});
