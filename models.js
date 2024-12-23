const mongoose = require('mongoose');

// Define Ad schema and model
const adSchema = new mongoose.Schema({
    category: String,
    src: String,
    advertiser: String,
    start_date: Date,
    end_date: Date,
    play_count: { type: Number, default: 0 },
    per_day_budget: { type: Number, required: true },
    amount: Number,
    per_play_amount: { type: Number, required: true },
    remaining_amount: { type: Number, default: 0 },
    publisher_plays: [{
        publisher: { type: mongoose.Schema.Types.ObjectId, ref: 'Publisher' },
        daily_played: { type: Number, default: 0 }
    }]
});

const Ad = mongoose.model('Ad', adSchema);

// Define BinAd schema and model for expired ads
const binAdSchema = new mongoose.Schema({
    category: String,
    src: String,
    advertiser: String,
    start_date: Date,
    end_date: Date,
    play_count: { type: Number, default: 0 },
    per_day_budget: { type: Number, required: true },
    amount: Number,
    per_play_amount: { type: Number, required: true },
    remaining_amount: { type: Number, default: 0 },
    publisher_plays: [{
        publisher: { type: mongoose.Schema.Types.ObjectId, ref: 'Publisher' },
        daily_played: { type: Number, default: 0 }
    }]
});

const BinAd = mongoose.model('BinAd', binAdSchema);

// Define Publisher schema and model
const publisherSchema = new mongoose.Schema({
    name: String,
    email: String,
    monthly_earnings: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true }
});

const Publisher = mongoose.model('Publisher', publisherSchema);

// Define Advertiser schema and model
const advertiserSchema = new mongoose.Schema({
    name: String,
    email: String,
    company: String
});

const Advertiser = mongoose.model('Advertiser', advertiserSchema);

module.exports = { Ad, BinAd, Publisher, Advertiser };
