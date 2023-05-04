const express = require('express');
const { login, register, checksession, verify, verified } = require('../controllers/user.controller');
const { isAuth, isAdmin } = require('../../middlewares/auth');
const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/checksession', [isAuth], checksession);
router.get('/verify/:userId/:uniqueString', verify);
router.get('/verified', verified);

module.exports = router;