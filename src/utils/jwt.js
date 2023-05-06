const jwt = require('jsonwebtoken');

const generateSign = (id, username, email) => {
    return jwt.sign({ id, username, email }, process.env.JWT_KEY, { expiresIn: '24h' });
}

const verifySign = (token) => {
    return jwt.verify(token, process.env.JWT_KEY);
}

module.exports = { generateSign, verifySign }