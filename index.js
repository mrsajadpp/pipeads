const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const app = express();
const port = 3001;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/pipeads', { useNewUrlParser: true, useUnifiedTopology: true });

// Define Ad schema and model
const adSchema = new mongoose.Schema({
    category: String,
    src: String,
    advertiser: String,
    email: String,
    start_date: Date,
    end_date: Date,
    play_count: Number,
    daily_play_limit: Number,
    daily_played: { type: Number, default: 0 },
    amount: Number
});

const Ad = mongoose.model('Ad', adSchema);

// Define BinAd schema and model for expired ads
const binAdSchema = new mongoose.Schema({
    category: String,
    src: String,
    advertiser: String,
    email: String,
    start_date: Date,
    end_date: Date,
    play_count: Number,
    daily_play_limit: Number,
    daily_played: { type: Number, default: 0 },
    amount: Number
});

const BinAd = mongoose.model('BinAd', binAdSchema);

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// Set view engine to EJS
app.set('view engine', 'ejs');

// Route to render form for inserting ads
app.get('/ads/new', (req, res) => {
    try {
        res.render('new_ad');
    } catch (error) {
        res.status(500).send({ error: 'Failed to load form' });
    }
});

// Route to insert a new ad
app.post('/ads', async (req, res) => {
    try {
        const { category, src, advertiser, email, start_date, end_date, daily_play_limit } = req.body;

        if (!category) {
            return res.status(400).send({ error: 'Category is required' });
        }
        if (!src) {
            return res.status(400).send({ error: 'Video Source URL is required' });
        }
        if (!advertiser) {
            return res.status(400).send({ error: 'Advertiser is required' });
        }
        if (!email) {
            return res.status(400).send({ error: 'Advertiser Email is required' });
        }
        if (!start_date) {
            return res.status(400).send({ error: 'Start Date is required' });
        }
        if (!end_date) {
            return res.status(400).send({ error: 'End Date is required' });
        }
        if (daily_play_limit === undefined) {
            return res.status(400).send({ error: 'Daily Play Limit is required' });
        }

        const dayLength = (new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24);
        const totalPlays = daily_play_limit * dayLength;
        const amount = totalPlays * 0.5; // Assuming 0.5 INR per play

        const adData = { category, src, advertiser, email, start_date, end_date, play_count: 0, daily_play_limit, amount };
        const ad = new Ad(adData);
        await ad.save();
        res.status(201).send(ad);
    } catch (error) {
        res.status(500).send({ error: 'Failed to insert ad' });
    }
});

// Route to remove ads with an ending date and move to bin
app.delete('/ads', async (req, res) => {
    try {
        const currentDate = new Date();
        const expiredAds = await Ad.find({ end_date: { $lt: currentDate } });
        await BinAd.insertMany(expiredAds);
        const result = await Ad.deleteMany({ end_date: { $lt: currentDate } });
        res.send(`Moved ${result.deletedCount} ads to bin`);
    } catch (error) {
        res.status(500).send({ error: 'Failed to remove ads' });
    }
});

// Route to stream video based on category
app.get('/stream', async (req, res) => {
    try {
        const category = req.query.category;
        
    } catch (error) {
        console.error(error);
        
        res.status(500).send({ error: 'Failed to stream video' });
    }
});

// Schedule job to run every 24 hours to move expired ads to bin
cron.schedule('0 0 * * *', async () => {
    try {
        const currentDate = new Date();
        const expiredAds = await Ad.find({ end_date: { $lt: currentDate } });
        await BinAd.insertMany(expiredAds);
        await Ad.deleteMany({ end_date: { $lt: currentDate } });
        console.log('Scheduled job: Moved expired ads to bin');
    } catch (error) {
        console.error('Scheduled job failed:', error);
    }
});

// Schedule job to reset daily_played to zero at 1 AM daily
cron.schedule('0 1 * * *', async () => {
    try {
        await Ad.updateMany({}, { $set: { daily_played: 0 } });
        console.log('Scheduled job: Reset daily_played to zero');
    } catch (error) {
        console.error('Scheduled job failed:', error);
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ error: 'Something went wrong!' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
