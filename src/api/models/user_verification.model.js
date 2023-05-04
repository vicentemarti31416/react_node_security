const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserVerificationSchema = new Schema({
    userId: { type: String, required: true },
    uniqueString: { type: String, required: true },
    createdAt: { type: Date },
    expiresAt: { type: Date }
})

const UserVerification = mongoose.model('user_verification', UserVerificationSchema);

module.exports = UserVerification;