'use strict';

const express = require('express');
const router = express.Router();
const { summary, byStore } = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/summary', summary);
router.get('/by-store', byStore);

module.exports = router;
