require('dotenv').config(); 

const { OAuth2Client } = require('google-auth-library');

const express = require('express');
const mongoose = require('mongoose'); 
const cors = require('cors'); 
const bcrypt = require('bcryptjs'); 
const Product = require("./models/Product");
const User = require('./models/User');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const OWNER_EMAIL = 'bemuowner@bemu.com'; 

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const app = express(); 
const PORT = process.env.PORT || 3000; 

app.use(cors()); 
app.use(express.json());
const pendingMfa = new Map();  //ADDED MFA STORAGE OUTSIDE ROUTES
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
//added new MFA verify route 
app.post("/api/mfa/verify", (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code){
    return res.status(400).json({ message: "missing email or code" });
  }
  const expected = pendingMfa.get(email);
  if (!expected) {
    return res.status(400).json({ message: "No MFA pending for this user"});
  }
  if (String(code) !== String(expected)){
    return res.status(401).json({ message: "Invalid code" });
  }
  pendingMfa.delete(email);
  return res.json({ message: "MFA success" });
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
   
   let role = 'customer'; 
     if (email === OWNER_EMAIL) {
	role = 'owner'; 
   }

  const user = await User.create({
     email, 
     passwordHash,
     role,  
   }); 


   return res.status(201).json({
     message: 'User registered successfully', 
     userID: user._id, 
     email: user.email,
     role: user.role, 
   }); 

  } catch (err) {
      console.error('Register error:', err); 
      res.status(500).json({ message: 'Server error' }); 
   } 
}); 

app.post('/api/login', async (req, res) => {
  try {
    console.log('LOGGING SCRIPT:', {
	method: req.method, 
	url: req.originalUrl, 
	ip: req.ip, 
	time: new Date().toISOString(), 
}); 
  const { email, password } = req.body || {}; 
  if (!email || !password) {
	return res 
	  .status(400)
	  .json({ mgessage: 'Email and password are required' }); 
	}
  const user = await User.findOne({ email }); 

  if (!user) {
	return res 
	  .status(401)
	  .json({ message: 'Invalid email or password' }); 
	} 

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
	return res 
	  .status(401)
	  .json ({ message: 'Invalid email or password' });
	} 

  const role = user.role || 'customer'; 
  const code = String(Math.floor(100000 + Math.random() * 900000));
  pendingMfa.set(email, code);

  return res.json({
	next: "mfa",  
	email: user.email, 
        code,
	role, 
	isOwner: role === 'owner', 
        userID: user._id,
  }); 

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

app.get("/api/products", async (req, res) => {
   try {
    const q = String(req.query.q || "").trim();
    if (!q) {
     const all = await Product.find().limit(50);
     return res.json(all);
    }
    
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const results = await Product.find({
      $or: [
        { name: regex }, 
        { tags: regex }, 
        { description: regex },
      ],
    }).limit(50);

    return res.json(results);

   } catch (err) {
     console.error("GET /api/products error:", err);
     return res.status(500).json({ message: "Server error" });
   }
 });

app.get("/api/products/:id", async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Product not found" });
    return res.json(p);
   } catch (err) {
     console.error("GET /api/products/:id error:", err);
     return res.status(500).json({ message: "Server error" });
    }
});

app.post("/api/products/:id/reviews", async (req, res) => {
  try {
    const { rating, text, authorEmail } = req.body || {};
    if (!rating || !text) {
       return res.status(400).json({ message: "rating and text required" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.reviews.push({
      rating: Number(rating),
      text: String(text).trim(),
      authorEmail: authorEmail ? String(authorEmail).trim() : undefined,
    });

    await product.save();
    return res.status(201).json({ message: "Review added" });
   } catch (err) {
     console.error("POST /api/products/:id/reviews error:", err);
     return res.status(500).json({ message: "Server error" });
   }

app.post('/api/google-login', async (req,res) => {
	try {
	  const { credential } = req.body; 
	if (!credential) {
	  return res.status(400).json({ message: 'Google credential missing' });
	}

	const ticket = await googleClient.verifyIdToken({
	  idToken: credential, 
	  audience: GOOGLE_CLIENT_ID,
	});

	const payload = ticket.getPayload();
	const email = payload && payload.email;

	if (!email) {
	  return res.status(400).json({ message: 'No email in Google token' });
	}

	let user = await User.findOne({ email }); 

	if (!user) {
	  let role = 'customer'; 
	  if (email === OWNER_EMAIL) {
		role = 'owner';
	}

	user = await User.create({
	  email,
	  passwordHash: 'google-oauth-account',
	  role, 
	});
	}

	const role = user.role || 'customer';

	return res.json({
	  message: 'Login successful', 
	  userID: user._id,
	  email: user.email, 
	  role, 
	  isOwner: role === 'owner', 
	});
	} catch (err) {
	  console.error('Google login error:', err);
	  return res.status(500).json({ message: 'Server error' }); 
	} 
});

});
