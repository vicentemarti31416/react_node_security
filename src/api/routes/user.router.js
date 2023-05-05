const express = require('express');
const { login, register, checksession, verify, verified, resetEmail, resetPassword } = require('../controllers/user.controller');
const { isAuth, isAdmin } = require('../../middlewares/auth');
const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/checksession', [isAuth], checksession);
router.get('/verify/:userId/:uniqueString', verify);
router.get('/verified', verified);
router.post('/resetEmail', resetEmail);
router.post('/resetPassword', resetPassword);

module.exports = router;