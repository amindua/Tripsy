require('dotenv').config();
const express = require('express');
const router = express.Router();
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGO_CONNECTION_STRING;
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1 } });
const DB_NAME = process.env.MONGO_DB_NAME;
const USERS = process.env.MONGO_COLLECTION;

router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Please enter both username and password.' });
  }
  if (req.session.user) {
    return res.redirect('/');
  }

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const user = await db.collection(USERS).findOne({ username });
    if (!user) {
      return res.render('login', { error: 'User not found.' });
    }

    if (user.password !== password) {
      return res.render('login', { error: 'Incorrect password.' });
    }

    req.session.user = username; 
    req.session.firstName = user.firstName;
    return res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  } finally {
    await client.close();
  }
});

router.get('/register', (req, res) => {
  res.render('register');
});

router.post('/register', async (req, res) => {
  const { username, password, firstName, lastName } = req.body;
  if (!username || !password || !firstName || !lastName) {
    return res.render('register', {
      error: 'All fields are required.',
      formData: req.body
    });
  }
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const users = db.collection(USERS);

    const exists = await users.findOne({ username });
    if (exists) {
      return res.render('register', { error: 'Username already taken.' });
    }

    await users.insertOne({ username, password, firstName, lastName });
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  } finally {
    await client.close();
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error("Session destroy error:", err);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});
module.exports = router;
