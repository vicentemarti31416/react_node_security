const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    email_verified: { type: Boolean, default: false },
    googleId: String
})

const User = mongoose.model('user', UserSchema);

module.exports = User;
