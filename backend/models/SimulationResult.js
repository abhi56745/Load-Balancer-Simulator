const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
  serverId: Number,
  currentLoad: Number,
  peakLoad: Number,
  maxCapacity: Number,
  requestsHandled: Number,
  status: String,
});

const simulationResultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  algorithm: String,
  totalRequests: Number,
  servers: [serverSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SimulationResult', simulationResultSchema);
