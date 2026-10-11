const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Socket.io initialization
const io = new Server(server, {
  cors: {
    origin: [CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true
  }
});

// Make io accessible in req.app
app.set('io', io);

// Socket authentication: verify the same JWT as the REST API (httpOnly cookie, or handshake auth token)
const jwt = require('jsonwebtoken');
const pool = require('./config/db');
const { JWT_SECRET } = require('./middleware/auth');

function readCookie(header, name) {
  if (!header) return null;
  const match = header.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || readCookie(socket.handshake.headers.cookie, 'token');
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, JWT_SECRET);
    const [users] = await pool.query(
      'SELECT id, role, business_id, branch_id, is_active, status, deleted_at FROM users WHERE id = ?',
      [decoded.id]
    );
    // Same rule as the API: only active, non-deleted accounts (is_active is 2 for declined/deleted)
    const u = users[0];
    if (!u || u.deleted_at || u.status !== 'active' || Number(u.is_active) !== 1) return next(new Error('Account is inactive or does not exist'));
    socket.user = users[0];
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
});

// Socket connection event — rooms are assigned server-side from the verified user, never from client input
io.on('connection', (socket) => {
  const { role, business_id, branch_id } = socket.user;
  if (role === 'super_admin') {
    socket.join('super_admin');
  } else {
    if (business_id) socket.join(`business_${business_id}`);
    if (branch_id) socket.join(`branch_${branch_id}`);
  }
  console.log(`🔌 Client connected to Socket.io [ID: ${socket.id}, user ${socket.user.id}]`);

  // Legacy: rooms are now joined automatically on connect; kept so old clients don't error.
  socket.on('join_warehouse', () => {});

  socket.on('disconnect', () => {
    console.log(`Client disconnected [ID: ${socket.id}]`);
  });
});

// Middleware
app.use(cors({
  origin: [CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/businesses', require('./routes/businesses'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/damage-reports', require('./routes/damage'));
app.use('/api/sales', require('./routes/sales'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', system: 'HQ Multi-Role Inventory API', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'A photo is too large. Each photo can be at most 5 MB.' });
  }
  if (err && err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ success: false, message: 'Too many photos. Attach up to 5.' });
  }
  if (err && err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: `Upload problem: ${err.message}` });
  }
  if (err && /Only JPEG, PNG, and WebP/.test(err.message || '')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'The request is too large.' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'The request could not be read (invalid JSON).' });
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
});

// Start server
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use: the backend is probably already running (another terminal or a background window).`);
    console.error(`Use that one, or close it and run this again. To see what is using the port: netstat -ano | findstr :${PORT}\n`);
    process.exit(1);
  }
  throw err;
});
server.listen(PORT, () => {
  console.log(`🚀 HQ Inventory Express API running on http://localhost:${PORT}`);
});
