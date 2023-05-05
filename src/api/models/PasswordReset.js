const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PasswordResetSchema = new Schema({
    userId: { type: String, required: true },
    resetString: { type: String, required: true },
    createdAt: { type: Date },
    expiresAt: { type: Date }
})

const UserVerification = mongoose.model('PasswordReset', PasswordResetSchema);

module.exports = UserVerification;