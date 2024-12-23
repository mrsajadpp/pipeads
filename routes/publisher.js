const express = require('express');
const bcrypt = require('bcrypt');
const { default: mongoose } = require('mongoose');
const Publisher = require('../models/Publisher');
const Ad = require('../models/Ad');
const router = express.Router();

// Middleware to check if publisher is logged in
function checkPublisherAuth(req, res, next) {
    if (req.session.userId && req.session.userType === 'publisher') {
        return next();
    } else {
        res.redirect('/publishers/login');
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

// Route to render login form for publishers
router.get('/login', preventPublisherAuth, (req, res) => {
    res.render('login_publisher', { error: null });
});

// Route to handle publisher login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const publisher = await Publisher.findOne({ email });
        if (!publisher) {
            return res.render('login_publisher', { error: 'Publisher not found' });
        }
        const isMatch = await bcrypt.compare(password, publisher.password);
        if (!isMatch) {
            return res.render('login_publisher', { error: 'Invalid credentials' });
        }
        req.session.userId = publisher._id;
        req.session.userType = 'publisher';
        res.redirect('/publishers/dashboard');
    } catch (error) {
        res.render('login_publisher', { error: 'Failed to login publisher' });
    }
});

// Route to render signup form for publishers
router.get('/signup', preventPublisherAuth, (req, res) => {
    res.render('signup_publisher', { error: null });
});

// Route to create a new publisher account
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password, category } = req.body;
        const existingPublisher = await Publisher.findOne({ email });
        if (existingPublisher) {
            return res.render('signup_publisher', { error: 'Publisher already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const publisher = new Publisher({ name, email, password: hashedPassword, category: category.toLowerCase() });
        await publisher.save();
        req.session.userId = publisher._id;
        req.session.userType = 'publisher';
        res.redirect('/publishers/dashboard');
    } catch (error) {
        res.render('signup_publisher', { error: 'Failed to create publisher account' });
    }
});

// Route to render publisher dashboard
router.get('/dashboard', checkPublisherAuth, async (req, res) => {
    try {
        const publisher = await Publisher.findById(req.session.userId);
        res.render('publisher_dashboard', { publisher, error: null });
    } catch (error) {
        res.render('publisher_dashboard', { publisher: null, error: 'Failed to load dashboard' });
    }
});

module.exports = router;
