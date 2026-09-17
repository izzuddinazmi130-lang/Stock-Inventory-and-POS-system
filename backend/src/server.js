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

// Socket connection event
io.on('connection', (socket) => {
  console.log(`🔌 Client connected to Socket.io [ID: ${socket.id}]`);

  socket.on('join_warehouse', (warehouseId) => {
    socket.join(`warehouse_${warehouseId}`);
    console.log(`Socket ${socket.id} joined room warehouse_${warehouseId}`);
  });

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', system: 'HQ Multi-Role Inventory API', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 HQ Inventory Express API running on http://localhost:${PORT}`);
});
