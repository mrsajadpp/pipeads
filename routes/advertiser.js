const express = require('express');
const bcrypt = require('bcrypt');
const { default: mongoose } = require('mongoose');
const Ad = require('../models/Ad');
const BinAd = require('../models/BinAd');
const Advertiser = require('../models/Advertiser');
const router = express.Router();

// Middleware to check if advertiser is logged in
function checkAdvertiserAuth(req, res, next) {
    if (req.session.userId && req.session.userType === 'advertiser') {
        return next();
    } else {
        res.redirect('/advertisers/login');
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

// Route to render login form for advertisers
router.get('/login', preventAdvertiserAuth, (req, res) => {
    res.render('login_advertiser', { error: null });
});

// Route to handle advertiser login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const advertiser = await Advertiser.findOne({ email });
        if (!advertiser) {
            return res.render('login_advertiser', { error: 'Advertiser not found' });
        }
        const isMatch = await bcrypt.compare(password, advertiser.password);
        if (!isMatch) {
            return res.render('login_advertiser', { error: 'Invalid credentials' });
        }
        req.session.userId = advertiser._id;
        req.session.userType = 'advertiser';
        res.redirect('/advertisers/dashboard');
    } catch (error) {
        res.render('login_advertiser', { error: 'Failed to login advertiser' });
    }
});

// Route to render signup form for advertisers
router.get('/signup', preventAdvertiserAuth, (req, res) => {
    res.render('signup_advertiser', { error: null });
});

// Route to create a new advertiser account
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password, company } = req.body;
        const existingAdvertiser = await Advertiser.findOne({ email });
        if (existingAdvertiser) {
            return res.render('signup_advertiser', { error: 'Advertiser already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const advertiser = new Advertiser({ name, email, password: hashedPassword, company });
        await advertiser.save();
        req.session.userId = advertiser._id;
        req.session.userType = 'advertiser';
        res.redirect('/advertisers/dashboard');
    } catch (error) {
        res.render('signup_advertiser', { error: 'Failed to create advertiser account' });
    }
});

// Route to render advertiser dashboard
router.get('/dashboard', checkAdvertiserAuth, async (req, res) => {
    try {
        const ads = await Ad.find({ advertiser: new mongoose.Types.ObjectId(req.session.userId) });
        const binAds = await BinAd.find({ advertiser: new mongoose.Types.ObjectId(req.session.userId) });
        res.render('advertiser_dashboard', { ads, binAds, error: null });
    } catch (error) {
        res.render('advertiser_dashboard', { ads: [], binAds: [], error: 'Failed to load dashboard' });
    }
});

module.exports = router;
