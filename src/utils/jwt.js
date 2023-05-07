const jwt = require('jsonwebtoken');

const generateSign = (id, name, email) => {
    return jwt.sign({ id, name, email }, process.env.JWT_KEY, { expiresIn: '24h' });
}

const verifySign = (token) => {
    return jwt.verify(token, process.env.JWT_KEY);
}

module.exports = { generateSign, verifySign }