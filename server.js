const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs'); // Changed from 'bcrypt' to 'bcryptjs'
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const uri = 'mongodb+srv://deepan9210:ZFXppIHXnvLMwsKM@cluster0.qllc7gh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);
let db;

async function connectToMongoDB() {
  try {
    await client.connect();
    db = client.db('dental');
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
  }
}

// Utility: Generate Patient ID like P0001
async function generatePatientID() {
  const collection = db.collection('Userdetails');
  const count = await collection.countDocuments();
  return `P${String(count + 1).padStart(4, '0')}`;
}

// ➤ API: Register Patient (with dummy OTP logic)
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !password || (!email && !phone)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const collection = db.collection('Userdetails');

    // Check if user exists
    const existingUser = await collection.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists with this email or phone.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const patientId = await generatePatientID();

    const newUser = {
      name,
      email,
      phone,
      password: hashedPassword,
      patientId,
      createdAt: new Date()
    };

    await collection.insertOne(newUser);

    res.json({ success: true, patientId });
  } catch (err) {
    console.error('❌ Registration Error:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again later.' });
  }
});

// ➤ API: Login using Patient ID or Phone
app.post('/api/login', async (req, res) => {
  try {
    const { idOrPhone, password } = req.body;
    if (!idOrPhone || !password) {
      return res.status(400).json({ error: 'Please enter Patient ID/Phone and password' });
    }

    const collection = db.collection('Userdetails');

    const user = await collection.findOne({
      $or: [{ patientId: idOrPhone }, { phone: idOrPhone }]
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    res.json({ success: true, name: user.name, patientId: user.patientId });
  } catch (err) {
    console.error('❌ Login Error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ➤ API: Dummy OTP sender (for now just simulate)
app.post('/api/send-otp', (req, res) => {
  const { method, value } = req.body;

  if (!value || !['email', 'phone'].includes(method)) {
    return res.status(400).json({ error: 'Invalid method or value' });
  }

  // Just simulate an OTP sent
  console.log(`📤 Simulating OTP sent to ${method}: ${value}`);
  res.json({ success: true, message: `OTP sent to your ${method}` });
});

// ➤ API: Dummy OTP verifier
app.post('/api/verify-otp', (req, res) => {
  const { otp } = req.body;
  // For demo purpose, accept any non-empty OTP
  if (!otp || otp.length < 4) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  res.json({ success: true, message: 'OTP verified successfully' });
});

// ➤ Existing API: Submit new case
app.post('/api/submit-case', async (req, res) => {
  try {
    const caseData = req.body;
    const collection = db.collection('case_sheets');
    const result = await collection.insertOne(caseData);
    res.json({ success: true, insertedId: result.insertedId });
  } catch (err) {
    console.error('❌ Failed to submit case:', err);
    res.status(500).json({ error: err.message });
  }
});

// ➤ Existing API: Get all cases
app.get('/api/cases', async (req, res) => {
  try {
    const cases = await db.collection('case_sheets').find({}).toArray();
    res.json(cases);
  } catch (err) {
    console.error('❌ Failed to fetch cases:', err);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// ➤ Existing API: Update case
app.put('/api/update-case/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const update = req.body;
    await db.collection('case_sheets').updateOne({ _id: new ObjectId(id) }, { $set: update });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Failed to update case:', err);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// ➤ Serve frontend files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'clef.html'));
});
app.get('/view', (req, res) => {
  res.sendFile(path.join(__dirname, 'view.html'));
});

// ➤ Start server after DB connection
connectToMongoDB().then(() => {
  app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
  });
});
