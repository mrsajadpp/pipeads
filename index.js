const express = require('express');
const cron = require('node-cron');
const session = require('express-session');
const { connectDB } = require('./db');
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

// Import routes
const advertiserRoutes = require('./routes/advertiser');
const publisherRoutes = require('./routes/publisher');
const adRoutes = require('./routes/ad');

// Use routes
app.use('/advertisers', advertiserRoutes);
app.use('/publishers', publisherRoutes);
app.use('/ads', adRoutes);

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
