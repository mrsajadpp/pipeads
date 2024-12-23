const mongoose = require('mongoose');

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


module.exports = BinAd;
