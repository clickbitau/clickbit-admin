const jwt = require('jsonwebtoken');

const payload = {
  id: process.env.PROFILE_ID || 16,
};

const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
console.log(token);
