const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulationController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/simulate', simulationController.runSimulation);
router.get('/simulate/compare', simulationController.compareAlgorithms);
router.get('/simulate/history', simulationController.getHistory);

module.exports = router;
