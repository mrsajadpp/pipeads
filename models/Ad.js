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

module.exports = Ad;
