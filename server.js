require('dotenv').config(); 

const express = require('express');
const mongoose = require('mongoose'); 
const cors = require('cors'); 
const bcrypt = require('bcryptjs'); 

const User = require('./models/User');

const app = express(); 
const PORT = process.env.PORT || 3000; 

app.use(cors()); 
app.use(express.json());

const http = require('http');
const LOGGING_SERVER_HOST = '192.168.10.13';
const LOGGING_SERVER_PORT = 4000;

app.use((req, res, next) => {
  const logEntry = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    time: new Date().toISOString(),
  };

  console.log('LOGGING SCRIPT:', logEntry);

  const data = JSON.stringify(logEntry);

  const options = {
    host: LOGGING_SERVER_HOST,
    port: LOGGING_SERVER_PORT,
    path: '/api/logs',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
  };

  const reqLog = http.request(options, resLog => {

    resLog.on('data', () => {});
  });

  reqLog.on('error', err => {
    console.error('Error sending log to logging VM:', err.message);
  });

  reqLog.write(data);
  reqLog.end();

  next();
});
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('connected to mongoDB'); 
})
  .catch((err) => {
    console.error('mongoDB connection error:', err); 
    process.exit(1); 
}); 


app.get('/', (req, res) => {
   res.send('Bemu backend is up');
});

app.post('/api/register', async (req,res) => {
  try {
    const { email, password } = req.body; 
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required ' }); 
    }

    const existing = await User.findOne({ email }); 
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' }); 
   }

   const passwordHash = await bcrypt.hash(password, 10); 
   const user = await User.create({
     email, 
     passwordHash, 
   }); 


   return res.status(201).json({
     message: 'User registered successfully', 
     userID: user._id, 
     email: user.email

   }); 

  } catch (err) {
      console.error('Register error:', err); 
      res.status(500).json({ message: 'Server error' }); 
   } 
}); 

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body; 
    if (!email, !password) {
      return res.status(400).json({ message: 'Email and password are required' }); 
    }

   const user = await User.findOne({ email }); 

   if (!user) {
      return res.status(401).json({ message: 'Invalid email or password'}); 

   }

   const isMatch = await bcrypt.compare(password, user.passwordHash); 
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password'}); 
    }
   
    return res.json({ message: 'Login successful' }); 
     } catch (err) {
        console.error('Login error:', err); 
        return res.status(500).json({ message: 'Server error' }); 
     } 
});

app.post('/api/log-test', (req, res) => {
  const { source, message } = req.body || {}; 
 
  console.log(
	'LOGGING SCRIPT: received log from', 
	source || 'unknown', 
	'-',
	message || '(no message)'
); 

	return res.json({ status: 'ok', received: { source, message } });
});

  app.listen(PORT, '0.0.0.0', () => {
	console.log(`Bemu backend listening on port ${PORT}`); 
});  


