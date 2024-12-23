const express = require('express');
const { default: mongoose } = require('mongoose');
const Ad = require('../models/Ad');
const Publisher = require('../models/Publisher');
const router = express.Router();

// Middleware to check if advertiser is logged in
function checkAdvertiserAuth(req, res, next) {
    if (req.session.userId && req.session.userType === 'advertiser') {
        return next();
    } else {
        res.redirect('/advertisers/login');
    }
}

// Route to render form for inserting ads
router.get('/new', checkAdvertiserAuth, (req, res) => {
    res.render('new_ad', { error: null });
});

// Route to insert a new ad
router.post('/', checkAdvertiserAuth, async (req, res) => {
    try {
        const { category, src, start_date, end_date, per_day_budget, per_play_amount } = req.body;
        const advertiser = req.session.userId;

        if (!category) {
            return res.render('new_ad', { error: 'Category is required' });
        }
        if (!src) {
            return res.render('new_ad', { error: 'Video Source URL is required' });
        }
        if (!start_date) {
            return res.render('new_ad', { error: 'Start Date is required' });
        }
        if (!end_date) {
            return res.render('new_ad', { error: 'End Date is required' });
        }
        if (!per_day_budget) {
            return res.render('new_ad', { error: 'Per Day Budget is required' });
        }
        if (!per_play_amount) {
            return res.render('new_ad', { error: 'Per Play Amount is required' });
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
        res.render('new_ad', { error: 'Failed to insert ad' });
    }
});

// Helper function to check if ObjectId was created today
function isObjectIdFromToday(objectId) {
    const timestamp = new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
    const today = new Date();
    return timestamp.toISOString().split('T')[0] === today.toISOString().split('T')[0];
}

router.get('/stream/:publisherId', async (req, res) => {
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

        // Find active ads with remaining budget
        const ads = await Ad.find({
            start_date: { $lte: currentDate },
            end_date: { $gte: currentDate },
            remaining_amount: { $gt: mongoose.Types.Decimal128.fromString("0") }
        });

        if (!ads.length) {
            return res.status(404).send({ error: 'No ad available for streaming' });
        }

        // Filter ads based on daily budget availability
        const availableAds = ads.filter(ad => {
            // Count plays from today using ObjectId timestamps
            const todayPlays = ad.publisher_plays
                .filter(play => isObjectIdFromToday(play._id.toString()))
                .reduce((sum, play) => sum + play.daily_played, 0);

            return todayPlays < ad.per_day_budget;
        });

        if (!availableAds.length) {
            return res.status(403).send({ error: 'All ads have reached their daily budget limit' });
        }

        // Randomly select from available ads
        const ad = availableAds[Math.floor(Math.random() * availableAds.length)];

        // Double check daily limit using ObjectId timestamps
        const todayPlays = ad.publisher_plays
            .filter(play => isObjectIdFromToday(play._id.toString()))
            .reduce((sum, play) => sum + play.daily_played, 0);

        if (todayPlays >= ad.per_day_budget) {
            return res.status(403).send({
                error: `Daily play limit reached. Today's plays: ${todayPlays}, Limit: ${ad.per_day_budget}`
            });
        }

        // Update ad statistics
        ad.play_count += 1;
        ad.remaining_amount -= ad.per_play_amount;

        // Add new play record
        ad.publisher_plays.push({
            publisher: publisherId,
            daily_played: (1 * ad.per_play_amount),
            // Note: MongoDB will automatically create an ObjectId with current timestamp
        });

        // Update publisher earnings
        publisher.monthly_earnings += ad.per_play_amount;

        // Save changes
        await Promise.all([
            ad.save(),
            publisher.save()
        ]);

        res.render('stream', { ad, publisher });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Failed to stream video' });
    }
});

module.exports = router;
