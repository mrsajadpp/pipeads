const mongoose = require('mongoose');

const publisherSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    monthly_earnings: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true }
});

const Publisher = mongoose.model('Publisher', publisherSchema);

module.exports = Publisher;
