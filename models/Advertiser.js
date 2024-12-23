const mongoose = require('mongoose');

const advertiserSchema = new mongoose.Schema({
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
    company: {
        type: String,
        required: true
    }
});

const Advertiser = mongoose.model('Advertiser', advertiserSchema);

module.exports = Advertiser;
