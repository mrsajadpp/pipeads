const express = require('express');
const cron = require('node-cron');
const { connectDB } = require('./db');
const { Ad, BinAd, Publisher, Advertiser } = require('./models');
const { default: mongoose } = require('mongoose');
const app = express();
const port = 3001;

// Connect to MongoDB
connectDB();

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// Set view engine to EJS
app.set('view engine', 'ejs');

// Route to render form for creating publisher account
app.get('/publishers/new', (req, res) => {
    try {
        res.render('new_publisher');
    } catch (error) {
        res.status(500).send({ error: 'Failed to load form' });
    }
});

// Route to create a new publisher account
app.post('/publishers', async (req, res) => {
    try {
        const { name, email, category } = req.body; // Removed website
        const publisher = new Publisher({ name, email, category: category.toLowerCase() }); // Removed website
        await publisher.save();
        res.status(201).send(publisher);
    } catch (error) {
        res.status(500).send({ error: 'Failed to create publisher account' });
    }
});

// Route to render form for creating advertiser account
app.get('/advertisers/new', (req, res) => {
    try {
        res.render('new_advertiser');
    } catch (error) {
        res.status(500).send({ error: 'Failed to load form' });
    }
});

// Route to create a new advertiser account
app.post('/advertisers', async (req, res) => {
    try {
        const { name, email, company } = req.body;
        const advertiser = new Advertiser({ name, email, company });
        await advertiser.save();
        res.status(201).send(advertiser);
    } catch (error) {
        res.status(500).send({ error: 'Failed to create advertiser account' });
    }
});

// Route to render form for inserting ads with advertiser list
app.get('/ads/new', async (req, res) => {
    try {
        const advertisers = await Advertiser.find();
        res.render('new_ad', { advertisers });
    } catch (error) {
        res.status(500).send({ error: 'Failed to load form' });
    }
});

// Route to insert a new ad
app.post('/ads', async (req, res) => {
    try {
        const { category, src, advertiser, start_date, end_date, daily_play_limit } = req.body;

        if (!category) {
            return res.status(400).send({ error: 'Category is required' });
        }
        if (!src) {
            return res.status(400).send({ error: 'Video Source URL is required' });
        }
        if (!advertiser) {
            return res.status(400).send({ error: 'Advertiser is required' });
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
        const per_play_amount = 0.5; // 0.5 INR per play

        const adData = {
            category,
            src,
            advertiser,
            start_date,
            end_date,
            play_count: 0,
            daily_play_limit,
            amount,
            per_play_amount,
            publisher_plays: []
        };

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

// Route to stream video based on category and update publisher earnings
app.get('/stream/:publisherId', async (req, res) => {
    const publisherId = req.params.publisherId;
    try {
        if (!publisherId) {
            return res.status(400).send({ error: 'Invalid Publisher ID' });
        }
        const currentDate = new Date();
        const publisher = await Publisher.findById(new mongoose.Types.ObjectId(publisherId));

        if (!publisher) {
            return res.status(404).send({ error: 'Publisher not found' });
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

// Schedule job to reset daily_played and publisher_plays at 1 AM daily
cron.schedule('0 1 * * *', async () => {
    try {
        await Ad.updateMany({}, {
            $set: {
                daily_played: 0,
                'publisher_plays.$[].daily_played': 0
            }
        });
        console.log('Scheduled job: Reset play counts to zero');
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
