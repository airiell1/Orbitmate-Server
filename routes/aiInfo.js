// routes/aiInfo.js
const express = require('express');
const router = express.Router();
const { getModelsInfoController } = require('../controllers/aiInfoController');
// const authMiddleware = require('../middleware/auth'); // If auth is needed later

// router.use(authMiddleware.verifyToken); // If auth is needed later

router.get('/models', getModelsInfoController);

module.exports = router;
