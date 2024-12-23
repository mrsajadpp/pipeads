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

// Route to stream video based on category and update publisher earnings
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

module.exports = router;
