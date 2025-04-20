const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== 'application/octet-stream' && !file.originalname.endsWith('.fbx')) {
      return cb(new Error('Only FBX files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'build')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// API endpoint for file upload
app.post('/api/upload', upload.single('fbxFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const fileInfo = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: `/uploads/${req.file.filename}`,
    uploadDate: new Date()
  };
  
  // Save file info to a JSON file for persistence
  const dbPath = path.join(__dirname, 'public', 'db.json');
  let db = [];
  
  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath);
    db = JSON.parse(data);
  }
  
  db.push(fileInfo);
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  
  res.json(fileInfo);
});

// API endpoint to get all uploaded files
app.get('/api/files', (req, res) => {
  const dbPath = path.join(__dirname, 'public', 'db.json');
  
  if (!fs.existsSync(dbPath)) {
    return res.json([]);
  }
  
  const data = fs.readFileSync(dbPath);
  const files = JSON.parse(data);
  
  res.json(files);
});

// Handle socket connections for real-time controller
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('controllerMovement', (data) => {
    // Broadcast the movement data to all connected clients except sender
    socket.broadcast.emit('modelMovement', data);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});