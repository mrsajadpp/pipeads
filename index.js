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
        const currentDate = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format

        const ads = await Ad.find({ category, start_date: { $lte: currentDate }, end_date: { $gte: currentDate } }).sort({ play_count: 1 });

        const totalPlayCountLeft = ads.reduce((sum, ad) => {
            const pastDays = Math.floor((new Date(currentDate) - new Date(ad.start_date)) / (1000 * 60 * 60 * 24));
            const adjustedDailyLimit = ad.daily_play_limit * (pastDays + 1); // Include today
            return sum + (adjustedDailyLimit - ad.play_count);
        }, 0);

        console.log(totalPlayCountLeft);
        

        if (totalPlayCountLeft > 0) {
            // Get the current date at midnight for accurate daily count comparison
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            // Find an ad that hasn't reached its daily limit
            const adToPlay = await Ad.findOneAndUpdate(
                {
                    category,
                    start_date: { $lte: currentDate },
                    end_date: { $gte: currentDate },
                    $expr: {
                        $lt: [
                            {
                                $subtract: [
                                    "$play_count",
                                    {
                                        $multiply: [
                                            "$daily_play_limit",
                                            {
                                                $floor: {
                                                    $divide: [
                                                        { $subtract: [new Date(), "$start_date"] },
                                                        1000 * 60 * 60 * 24 // milliseconds in a day
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                ]
                            },
                            "$daily_play_limit"
                        ]
                    }
                },
                { $inc: { play_count: 1 } },
                { sort: { play_count: 1 }, new: true }
            );

            if (adToPlay) {
                res.render('stream', { ad: adToPlay }); 
            } else {
                res.status(404).send('No ads available for playing at this time');
            }
        } else {
            res.status(404).send('No ads available for playing at this time');
        }
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

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ error: 'Something went wrong!' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
