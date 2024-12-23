const express = require('express');
const cron = require('node-cron');
const bcrypt = require('bcrypt');
const session = require('express-session');
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

// Session middleware
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Middleware to check if advertiser is logged in
function checkAdvertiserAuth(req, res, next) {
    if (req.session.userId && req.session.userType === 'advertiser') {
        return next();
    } else {
        res.redirect('/advertisers/login');
    }
}

// Middleware to check if publisher is logged in
function checkPublisherAuth(req, res, next) {
    if (req.session.userId && req.session.userType === 'publisher') {
        return next();
    } else {
        res.redirect('/publishers/login');
    }
}

// Middleware to prevent logged-in advertisers from accessing login/signup pages
function preventAdvertiserAuth(req, res, next) {
    if (req.session.userId && req.session.userType === 'advertiser') {
        res.redirect('/advertisers/dashboard');
    } else {
        next();
    }
}

// Middleware to prevent logged-in publishers from accessing login/signup pages
function preventPublisherAuth(req, res, next) {
    if (req.session.userId && req.session.userType === 'publisher') {
        res.redirect('/publishers/dashboard');
    } else {
        next();
    }
}

// Route to render login form for advertisers
app.get('/advertisers/login', preventAdvertiserAuth, (req, res) => {
    res.render('login_advertiser');
});

// Route to handle advertiser login
app.post('/advertisers/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const advertiser = await Advertiser.findOne({ email });
        if (!advertiser) {
            return res.status(404).send({ error: 'Advertiser not found' });
        }
        const isMatch = await bcrypt.compare(password, advertiser.password);
        if (!isMatch) {
            return res.status(400).send({ error: 'Invalid credentials' });
        }
        req.session.userId = advertiser._id;
        req.session.userType = 'advertiser';
        res.redirect('/advertisers/dashboard');
    } catch (error) {
        res.status(500).send({ error: 'Failed to login advertiser' });
    }
});

// Route to render login form for publishers
app.get('/publishers/login', preventPublisherAuth, (req, res) => {
    res.render('login_publisher');
});

// Route to handle publisher login
app.post('/publishers/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const publisher = await Publisher.findOne({ email });
        if (!publisher) {
            return res.status(404).send({ error: 'Publisher not found' });
        }
        const isMatch = await bcrypt.compare(password, publisher.password);
        if (!isMatch) {
            return res.status(400).send({ error: 'Invalid credentials' });
        }
        req.session.userId = publisher._id;
        req.session.userType = 'publisher';
        res.redirect('/publishers/dashboard');
    } catch (error) {
        res.status(500).send({ error: 'Failed to login publisher' });
    }
});

// Route to render signup form for advertisers
app.get('/advertisers/signup', preventAdvertiserAuth, (req, res) => {
    res.render('signup_advertiser');
});

// Route to create a new advertiser account
app.post('/advertisers/signup', async (req, res) => {
    try {
        const { name, email, password, company } = req.body;
        const existingAdvertiser = await Advertiser.findOne({ email });
        if (existingAdvertiser) {
            return res.status(400).send({ error: 'Advertiser already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const advertiser = new Advertiser({ name, email, password: hashedPassword, company });
        await advertiser.save();
        req.session.userId = advertiser._id;
        req.session.userType = 'advertiser';
        res.redirect('/advertisers/dashboard');
    } catch (error) {
        res.status(500).send({ error: 'Failed to create advertiser account' });
    }
});

// Route to render signup form for publishers
app.get('/publishers/signup', preventPublisherAuth, (req, res) => {
    res.render('signup_publisher');
});

// Route to create a new publisher account
app.post('/publishers/signup', async (req, res) => {
    try {
        const { name, email, password, category } = req.body;
        const existingPublisher = await Publisher.findOne({ email });
        if (existingPublisher) {
            return res.status(400).send({ error: 'Publisher already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const publisher = new Publisher({ name, email, password: hashedPassword, category: category.toLowerCase() });
        await publisher.save();
        req.session.userId = publisher._id;
        req.session.userType = 'publisher';
        res.redirect('/publishers/dashboard');
    } catch (error) {
        res.status(500).send({ error: 'Failed to create publisher account' });
    }
});

// Route to render advertiser dashboard
app.get('/advertisers/dashboard', checkAdvertiserAuth, async (req, res) => {
    try {
        const ads = await Ad.find({ advertiser: req.session.userId });
        res.render('advertiser_dashboard', { ads });
    } catch (error) {
        res.status(500).send({ error: 'Failed to load dashboard' });
    }
});

// Route to render publisher dashboard
app.get('/publishers/dashboard', checkPublisherAuth, async (req, res) => {
    try {
        const publisher = await Publisher.findById(req.session.userId);
        res.render('publisher_dashboard', { publisher });
    } catch (error) {
        res.status(500).send({ error: 'Failed to load dashboard' });
    }
});

// Route to render form for inserting ads with advertiser list
app.get('/ads/new', checkAdvertiserAuth, async (req, res) => {
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
        const { category, src, advertiser, start_date, end_date, per_day_budget, per_play_amount } = req.body;

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
        if (!per_day_budget) {
            return res.status(400).send({ error: 'Per Day Budget is required' });
        }
        if (!per_play_amount) {
            return res.status(400).send({ error: 'Per Play Amount is required' });
        }

        const dayLength = (new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24);
        const totalPlays = per_day_budget / per_play_amount;
        const amount = totalPlays * dayLength * per_play_amount;
        const remaining_amount = amount;

        const adData = {
            category,
            src,
            advertiser,
            start_date,
            end_date,
            play_count: 0,
            per_day_budget,
            amount,
            per_play_amount,
            remaining_amount,
            publisher_plays: []
        };

        const ad = new Ad(adData);
        await ad.save();
        res.status(201).send(ad);
    } catch (error) {
        res.status(500).send({ error: 'Failed to insert ad' });
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

        const ads = await Ad.find({
            start_date: { $lte: currentDate },
            end_date: { $gte: currentDate },
            remaining_amount: { $gte: mongoose.Types.Decimal128.fromString("0") }
        });

        if (!ads.length) {
            return res.status(404).send({ error: 'No ad available for streaming' });
        }

        const ad = ads[Math.floor(Math.random() * ads.length)];

        const dailyPlayLimit = ad.per_day_budget / ad.per_play_amount;
        const totalDailyPlays = ad.publisher_plays.reduce((sum, play) => sum + play.daily_played, 0);

        if (totalDailyPlays >= dailyPlayLimit) {
            return res.status(403).send({ error: 'Daily play limit exceeded' });
        }

        ad.play_count += 1;
        ad.remaining_amount -= ad.per_play_amount;

        const publisherPlay = ad.publisher_plays.find(play => play.publisher.toString() === publisherId);
        if (publisherPlay) {
            publisherPlay.daily_played += 1;
        } else {
            ad.publisher_plays.push({ publisher: publisherId, daily_played: 1 });
        }

        publisher.monthly_earnings += ad.per_play_amount;

        await ad.save();
        await publisher.save();

        res.render('stream', { ad, publisher });
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
        const binAds = expiredAds.map(ad => ({
            ...ad.toObject(),
            per_play_amount: ad.per_play_amount,
            remaining_amount: ad.remaining_amount
        }));
        await BinAd.insertMany(binAds);
        const result = await Ad.deleteMany({ end_date: { $lt: currentDate } });
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
