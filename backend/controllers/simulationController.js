const mongoose = require('mongoose');
const SimulationResult = require('../models/SimulationResult');

// ═══════════════════════════════════════════════════════════════════════════
//  UTILITY: HASHING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Murmur3-inspired 32-bit hash.  Deterministic, well-distributed, fast.
 * Used by Ring Hash, Maglev, HRW, IP Hash, Bounded CH.
 */
const murmur3_32 = (key, seed = 0x9747b28c) => {
    let h = seed ^ key.length;
    let i = 0;
    const len = key.length;

    while (i + 4 <= len) {
        let k =
            (key.charCodeAt(i)     & 0xff)       |
            ((key.charCodeAt(i+1)  & 0xff) << 8) |
            ((key.charCodeAt(i+2)  & 0xff) << 16)|
            ((key.charCodeAt(i+3)  & 0xff) << 24);
        k = Math.imul(k, 0xcc9e2d51);
        k = (k << 15) | (k >>> 17);
        k = Math.imul(k, 0x1b873593);
        h ^= k;
        h = (h << 13) | (h >>> 19);
        h = Math.imul(h, 5) + 0xe6546b64;
        i += 4;
    }

    let k = 0;
    switch (len - i) {
        case 3: k ^= (key.charCodeAt(i+2) & 0xff) << 16; // falls through
        case 2: k ^= (key.charCodeAt(i+1) & 0xff) << 8;  // falls through
        case 1: k ^= (key.charCodeAt(i)   & 0xff);
                k = Math.imul(k, 0xcc9e2d51);
                k = (k << 15) | (k >>> 17);
                k = Math.imul(k, 0x1b873593);
                h ^= k;
    }

    h ^= len;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;

    return h >>> 0; // ensure unsigned
};

/** Second hash with a different seed – for algorithms needing two hashes */
const murmur3_32_b = (key) => murmur3_32(key, 0x12345678);

/** Simple legacy hash for backward-compat fields that don't need distribution */
const hashString = (str) => murmur3_32(str);


// ═══════════════════════════════════════════════════════════════════════════
//  SERVER GENERATION
// ═══════════════════════════════════════════════════════════════════════════

const initialServers = (count = 4, baseCapacity = 1000, heterogeneous = false) => {
    return Array.from({ length: count }, (_, i) => {
        const multiplier = heterogeneous
            ? (i % 3 === 0 ? 1.5 : (i % 2 === 0 ? 0.8 : 1))
            : 1;
        const capacity = Math.floor(baseCapacity * multiplier);
        const weight = Math.max(1, Math.floor(10 * multiplier));

        return {
            serverId: i + 1,
            currentLoad: 0,
            peakLoad: 0,
            activeConnections: 0,
            maxCapacity: capacity,
            requestsHandled: 0,
            status: 'Normal',
            weight: weight,
            currentWeight: 0,          // for SWRR
            effectiveWeight: weight,    // for SWRR (tracks failures)
            baseLatency: 10 / multiplier,
            ewma: 10,
            zone: i % 2 === 0 ? 'A' : 'B',
            isDown: false,
            autoScaled: false,
        };
    });
};

const createServer = (serverId, capacity, autoScaled = false) => ({
    serverId,
    currentLoad: 0,
    peakLoad: 0,
    activeConnections: 0,
    maxCapacity: capacity,
    requestsHandled: 0,
    status: 'Normal',
    weight: 10,
    currentWeight: 0,
    effectiveWeight: 10,
    baseLatency: 10,
    ewma: 10,
    zone: serverId % 2 === 0 ? 'A' : 'B',
    isDown: false,
    autoScaled,
});


// ═══════════════════════════════════════════════════════════════════════════
//  REQUEST GENERATION (Realistic)
// ═══════════════════════════════════════════════════════════════════════════

const generateRequests = (count) => {
    const requests = [];
    let currentTime = 0;

    for (let i = 0; i < count; i++) {
        // Bursty arrivals: 20 % chance of no gap (burst)
        const isBurst = Math.random() < 0.2;
        const gap = isBurst ? 0 : Math.floor(Math.random() * 15) + 1;
        currentTime += gap;

        // Heavy-tail duration distribution
        let duration;
        const rand = Math.random();
        if (rand < 0.8)       duration = Math.floor(Math.random() * 20)  + 10;  // 10-30 ms
        else if (rand < 0.95) duration = Math.floor(Math.random() * 50)  + 30;  // 30-80 ms
        else                  duration = Math.floor(Math.random() * 200) + 100; // 100-300 ms

        requests.push({
            id: i + 1,
            load: Math.floor(Math.random() * 8) + 2, // 2-9 units
            arrivalTime: currentTime,
            duration: duration,
            sourceIP: `10.${(i * 7 + 3) % 256}.${(i * 13 + 11) % 256}.${(i * 31 + 7) % 256}`,
        });
    }
    return requests;
};


// ═══════════════════════════════════════════════════════════════════════════
//  STATUS HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const updateStatuses = (servers) => {
    servers.forEach(server => {
        const pct = server.currentLoad / server.maxCapacity;
        if (pct >= 0.9)      server.status = 'Overloaded';
        else if (pct >= 0.6) server.status = 'High';
        else                 server.status = 'Normal';
    });
};

const canAcceptRequest = (server, req) =>
    (server.currentLoad + req.load) <= server.maxCapacity;

const getProjectedUsage = (server, req) =>
    (server.currentLoad + req.load) / server.maxCapacity;

const sortByProjectedUsage = (req, left, right) => {
    const usageDiff = getProjectedUsage(left, req) - getProjectedUsage(right, req);
    if (usageDiff !== 0) return usageDiff;
    const activeDiff = left.activeConnections - right.activeConnections;
    if (activeDiff !== 0) return activeDiff;
    return left.serverId - right.serverId;
};

const createAutoScaledServer = (servers, baseCapacity) => {
    const nextServerId = servers.reduce((maxId, s) => Math.max(maxId, s.serverId), 0) + 1;
    const nextServer = createServer(nextServerId, baseCapacity, true);
    servers.push(nextServer);
    return nextServer;
};

const compareServerPressure = (left, right) => {
    const activeDiff = left.activeConnections - right.activeConnections;
    if (activeDiff !== 0) return activeDiff;

    const leftUsage = left.maxCapacity > 0 ? left.currentLoad / left.maxCapacity : 0;
    const rightUsage = right.maxCapacity > 0 ? right.currentLoad / right.maxCapacity : 0;
    if (leftUsage !== rightUsage) return leftUsage - rightUsage;

    const handledDiff = left.requestsHandled - right.requestsHandled;
    if (handledDiff !== 0) return handledDiff;

    return left.serverId - right.serverId;
};

const getApertureSubsetSize = (servers) => {
    if (servers.length <= 2) {
        return servers.length;
    }

    return Math.min(servers.length, Math.max(2, Math.ceil(Math.sqrt(servers.length))));
};

const getSlidingApertureSubset = (available, state) => {
    const orderedServers = [...available].sort((left, right) => left.serverId - right.serverId);
    const serverKey = orderedServers.map(server => server.serverId).join(',');

    if (state.apertureWindowStart == null || Number.isNaN(state.apertureWindowStart)) {
        state.apertureWindowStart = 0;
    }

    if (state.apertureServerKey !== serverKey) {
        state.apertureServerKey = serverKey;
        state.apertureWindowStart %= orderedServers.length;
    }

    const subsetSize = getApertureSubsetSize(orderedServers);
    const startIndex = state.apertureWindowStart % orderedServers.length;
    const subset = Array.from({ length: subsetSize }, (_, offset) =>
        orderedServers[(startIndex + offset) % orderedServers.length]
    );

    state.apertureWindowStart = (startIndex + 1) % orderedServers.length;
    return subset;
};

const selectFromApertureSubset = (req, subset) => {
    if (subset.length === 1) {
        return subset[0];
    }

    const firstIndex = murmur3_32(`aperture:${req.id}:a`) % subset.length;
    let secondIndex = murmur3_32(`aperture:${req.id}:b`) % subset.length;

    if (secondIndex === firstIndex) {
        secondIndex = (secondIndex + 1) % subset.length;
    }

    const first = subset[firstIndex];
    const second = subset[secondIndex];

    return compareServerPressure(first, second) <= 0 ? first : second;
};


// ═══════════════════════════════════════════════════════════════════════════
//  RING HASH – Consistent Hashing with Virtual Nodes (CRITICAL FIX)
// ═══════════════════════════════════════════════════════════════════════════

class ConsistentHashRing {
    /**
     * @param {Array} servers – available server objects
     * @param {number} virtualNodesPerServer – 150 by default (100-200 range)
     */
    constructor(servers, virtualNodesPerServer = 150) {
        this.ring = [];                 // sorted array of { hash, serverId }
        this.virtualNodesPerServer = virtualNodesPerServer;
        this._build(servers);
    }

    _build(servers) {
        this.ring = [];
        for (const server of servers) {
            for (let v = 0; v < this.virtualNodesPerServer; v++) {
                const key = `srv-${server.serverId}-vn-${v}`;
                const hash = murmur3_32(key);
                this.ring.push({ hash, serverId: server.serverId });
            }
        }
        // Sort ring by hash value – critical for binary search
        this.ring.sort((a, b) => a.hash - b.hash);
    }

    /**
     * Find the nearest node clockwise on the ring via binary search.
     * @param {string} requestKey
     * @returns {number} serverId
     */
    lookup(requestKey) {
        const hash = murmur3_32(requestKey);
        let lo = 0, hi = this.ring.length - 1;

        // If hash is greater than all ring positions, wrap to first node
        if (hash > this.ring[hi].hash) {
            return this.ring[0].serverId;
        }

        // Binary search for the first ring position >= hash
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (this.ring[mid].hash < hash) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }

        return this.ring[lo].serverId;
    }
}


// ═══════════════════════════════════════════════════════════════════════════
//  MAGLEV HASHING – Lookup Table Construction
// ═══════════════════════════════════════════════════════════════════════════

class MaglevTable {
    /**
     * Build a Maglev lookup table.
     * Table size M should be a prime >> number of backends.
     */
    constructor(servers) {
        this.servers = servers;
        // Pick a prime ≥ 251 for small-server setups, good enough for simulation.
        this.M = this._nextPrime(Math.max(251, servers.length * 100));
        this.table = this._build();
    }

    _nextPrime(n) {
        const isPrime = (v) => {
            if (v < 2) return false;
            for (let i = 2; i * i <= v; i++) { if (v % i === 0) return false; }
            return true;
        };
        while (!isPrime(n)) n++;
        return n;
    }

    _build() {
        const n = this.servers.length;
        const M = this.M;
        const table = new Array(M).fill(-1);

        // Compute offset and skip for each backend (two independent hashes)
        const offsets = [];
        const skips = [];
        for (const s of this.servers) {
            const key = `maglev-srv-${s.serverId}`;
            offsets.push(murmur3_32(key) % M);
            skips.push((murmur3_32_b(key) % (M - 1)) + 1);
        }

        // Permutation array
        const next = new Array(n).fill(0);
        let filled = 0;

        while (filled < M) {
            for (let i = 0; i < n && filled < M; i++) {
                let c = (offsets[i] + next[i] * skips[i]) % M;
                while (table[c] !== -1) {
                    next[i]++;
                    c = (offsets[i] + next[i] * skips[i]) % M;
                }
                table[c] = i; // backend index
                next[i]++;
                filled++;
            }
        }

        return table;
    }

    lookup(requestKey) {
        const hash = murmur3_32(requestKey) % this.M;
        const idx = this.table[hash];
        return this.servers[idx];
    }
}


// ═══════════════════════════════════════════════════════════════════════════
//  ALGORITHM SELECTION – Production-Grade Implementations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * selectServer(algo, req, servers, state) → chosen server object
 *
 * `state` persists across requests within a single simulation run.
 * It holds pre-built data structures (hash rings, Maglev tables, etc.)
 * and algorithm-specific cursors.
 */
const selectServer = (algo, req, servers, state) => {
    const available = servers.filter(s => !s.isDown);
    if (available.length === 0) return servers[0];

    switch (algo) {

    // ───── CORE ─────

    case 'roundrobin': {
        // True round-robin with a stable index
        if (state.rrIndex == null) state.rrIndex = -1;
        state.rrIndex = (state.rrIndex + 1) % available.length;
        return available[state.rrIndex];
    }

    case 'swrr': {
        // Nginx Smooth Weighted Round Robin (SWRR)
        // Each iteration: cw += ew; pick max cw; cw -= totalEw
        let totalEw = 0;
        let best = null;

        for (const s of available) {
            s.currentWeight += s.effectiveWeight;
            totalEw += s.effectiveWeight;
            if (!best || s.currentWeight > best.currentWeight) {
                best = s;
            }
        }
        best.currentWeight -= totalEw;
        return best;
    }

    case 'least': {
        // Least connections: pick server with fewest active connections.
        // Tie-break on serverId for determinism.
        let best = available[0];
        for (let i = 1; i < available.length; i++) {
            const s = available[i];
            if (s.activeConnections < best.activeConnections ||
                (s.activeConnections === best.activeConnections && s.serverId < best.serverId)) {
                best = s;
            }
        }
        return best;
    }

    case 'leastoutstanding': {
        // Least outstanding requests: use currentLoad / capacity (normalized)
        let best = available[0];
        let bestRatio = best.currentLoad / best.maxCapacity;
        for (let i = 1; i < available.length; i++) {
            const ratio = available[i].currentLoad / available[i].maxCapacity;
            if (ratio < bestRatio ||
                (ratio === bestRatio && available[i].serverId < best.serverId)) {
                bestRatio = ratio;
                best = available[i];
            }
        }
        return best;
    }

    case 'p2c': {
        // Power of Two Choices: sample two random servers, pick lowest connections
        if (available.length === 1) return available[0];
        const i1 = Math.floor(Math.random() * available.length);
        let i2 = Math.floor(Math.random() * (available.length - 1));
        if (i2 >= i1) i2++; // ensure distinct
        const s1 = available[i1], s2 = available[i2];
        return s1.activeConnections <= s2.activeConnections ? s1 : s2;
    }

    case 'p2cewma': {
        // P2C with Peak EWMA – latency-aware
        if (available.length === 1) return available[0];
        const i1 = Math.floor(Math.random() * available.length);
        let i2 = Math.floor(Math.random() * (available.length - 1));
        if (i2 >= i1) i2++;
        const s1 = available[i1], s2 = available[i2];
        // Score = outstanding * ewma (lower is better)
        const score1 = (s1.activeConnections + 1) * s1.ewma;
        const score2 = (s2.activeConnections + 1) * s2.ewma;
        return score1 <= score2 ? s1 : s2;
    }

    case 'iphash': {
        // Source IP hashing
        const ip = req.sourceIP || `10.0.0.${req.id}`;
        const hash = murmur3_32(ip);
        return available[hash % available.length];
    }

    // ───── HASH-BASED (CRITICAL – CORRECT IMPLEMENTATIONS) ─────

    case 'ringhash': {
        // Consistent hashing with virtual nodes – FIXED
        if (!state.hashRing || state.hashRingServerKey !== available.map(s => s.serverId).join(',')) {
            state.hashRing = new ConsistentHashRing(available, 150);
            state.hashRingServerKey = available.map(s => s.serverId).join(',');
        }
        const targetId = state.hashRing.lookup(`request-${req.id}`);
        return available.find(s => s.serverId === targetId) || available[0];
    }

    case 'maglev': {
        // Maglev hashing with lookup table
        if (!state.maglevTable || state.maglevServerKey !== available.map(s => s.serverId).join(',')) {
            state.maglevTable = new MaglevTable(available);
            state.maglevServerKey = available.map(s => s.serverId).join(',');
        }
        return state.maglevTable.lookup(`request-${req.id}`);
    }

    case 'hrw': {
        // Rendezvous / Highest Random Weight hashing
        let maxScore = -1;
        let best = available[0];
        for (const s of available) {
            const score = murmur3_32(`${req.id}-${s.serverId}`);
            if (score > maxScore) { maxScore = score; best = s; }
        }
        return best;
    }

    case 'localityaware': {
        // Locality-aware: prefer same-zone servers; fallback to least-loaded
        const clientZone = req.id % 2 === 0 ? 'A' : 'B';
        const local = available.filter(s => s.zone === clientZone);
        const pool = local.length > 0 ? local : available;
        let best = pool[0];
        for (const s of pool) {
            const ratio = s.currentLoad / s.maxCapacity;
            const bestRatio = best.currentLoad / best.maxCapacity;
            if (ratio < bestRatio) best = s;
        }
        return best;
    }

    // ───── ADVANCED ─────

    case 'random':
        return available[Math.floor(Math.random() * available.length)];

    case 'weighted': {
        // Weighted random selection (weight-proportional)
        const total = available.reduce((acc, s) => acc + s.weight, 0);
        let r = Math.random() * total;
        for (const s of available) {
            r -= s.weight;
            if (r <= 0) return s;
        }
        return available[available.length - 1];
    }

    case 'jsq': {
        // Join Shortest Queue: equivalent to least connections but accounts for queue depth
        // In a simulation without explicit queues, use activeConnections
        let best = available[0];
        for (let i = 1; i < available.length; i++) {
            if (available[i].activeConnections < best.activeConnections) best = available[i];
        }
        return best;
    }

    case 'jiq': {
        // Join Idle Queue: prefer idle servers; fallback to P2C among busy ones
        const idle = available.filter(s => s.activeConnections === 0);
        if (idle.length > 0) {
            return idle[Math.floor(Math.random() * idle.length)];
        }
        // Fallback: P2C among busy servers
        if (available.length === 1) return available[0];
        const i1 = Math.floor(Math.random() * available.length);
        let i2 = Math.floor(Math.random() * (available.length - 1));
        if (i2 >= i1) i2++;
        const s1 = available[i1], s2 = available[i2];
        return s1.activeConnections <= s2.activeConnections ? s1 : s2;
    }

    case 'sed': {
        // Shortest Expected Delay: (activeConnections + 1) / weight
        let best = available[0];
        let minDelay = (best.activeConnections + 1) / best.weight;
        for (let i = 1; i < available.length; i++) {
            const expected = (available[i].activeConnections + 1) / available[i].weight;
            if (expected < minDelay) { minDelay = expected; best = available[i]; }
        }
        return best;
    }

    case 'boundedch': {
        // Consistent Hashing with Bounded Loads (Google 2017 paper)
        // Use ring hash, but reject servers whose load > avg * (1 + ε)
        if (!state.boundedRing || state.boundedRingKey !== available.map(s => s.serverId).join(',')) {
            state.boundedRing = new ConsistentHashRing(available, 150);
            state.boundedRingKey = available.map(s => s.serverId).join(',');
        }

        const totalLoad = available.reduce((acc, s) => acc + s.activeConnections, 0);
        const avgLoad = totalLoad / available.length;
        const epsilon = 0.25;
        const threshold = Math.max(1, Math.ceil(avgLoad * (1 + epsilon)));

        // Walk the ring from the target position to find an acceptable server
        const hash = murmur3_32(`request-${req.id}`);
        const ring = state.boundedRing.ring;
        let lo = 0, hi = ring.length - 1;
        if (hash > ring[hi].hash) { lo = 0; }
        else {
            while (lo < hi) {
                const mid = (lo + hi) >>> 1;
                if (ring[mid].hash < hash) lo = mid + 1; else hi = mid;
            }
        }

        // Walk clockwise from `lo`, checking load bound
        for (let attempt = 0; attempt < ring.length; attempt++) {
            const idx = (lo + attempt) % ring.length;
            const candidate = available.find(s => s.serverId === ring[idx].serverId);
            if (candidate && candidate.activeConnections <= threshold) {
                return candidate;
            }
        }
        // Fallback: least loaded
        return available.reduce((best, s) =>
            s.activeConnections < best.activeConnections ? s : best, available[0]);
    }

    case 'aperture': {
        const subset = getSlidingApertureSubset(available, state);
        return selectFromApertureSubset(req, subset);
    }

    case 'weightedrandomam': {
        // Weighted Random with Anomaly Mitigation
        // Reduce weight for overloaded or high-latency servers
        const adjustedWeights = available.map(s => {
            let w = s.weight;
            const usage = s.currentLoad / s.maxCapacity;
            if (usage >= 0.9) w *= 0.1;       // severely penalize overloaded
            else if (usage >= 0.7) w *= 0.4;   // reduce for high usage
            // Also penalize high latency
            if (s.ewma > 50) w *= 0.5;
            return Math.max(0.01, w);
        });
        const total = adjustedWeights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < available.length; i++) {
            r -= adjustedWeights[i];
            if (r <= 0) return available[i];
        }
        return available[available.length - 1];
    }

    default:
        return available[0];
    }
};


// ═══════════════════════════════════════════════════════════════════════════
//  SERVER ASSIGNMENT WITH OVERFLOW & AUTO-SCALING
// ═══════════════════════════════════════════════════════════════════════════

const resolveServerAssignment = (algo, req, servers, state, baseCapacity) => {
    const available = servers.filter(server => !server.isDown);
    if (available.length === 0) {
        return {
            server: servers[0],
            preferredServerId: servers[0]?.serverId ?? null,
            rerouted: false,
            rerouteReason: null,
        };
    }

    const preferredServer = selectServer(algo, req, servers, state);

    if (preferredServer && canAcceptRequest(preferredServer, req)) {
        return {
            server: preferredServer,
            preferredServerId: preferredServer.serverId,
            rerouted: false,
            rerouteReason: null,
        };
    }

    const safeAlternatives = available
        .filter(server => canAcceptRequest(server, req))
        .sort((left, right) => sortByProjectedUsage(req, left, right));

    if (safeAlternatives.length > 0) {
        return {
            server: safeAlternatives[0],
            preferredServerId: preferredServer?.serverId ?? safeAlternatives[0].serverId,
            rerouted: true,
            rerouteReason: 'capacity',
            autoScaled: false,
        };
    }

    const autoScaledServer = createAutoScaledServer(servers, baseCapacity);
    return {
        server: autoScaledServer,
        preferredServerId: preferredServer?.serverId ?? autoScaledServer.serverId,
        rerouted: true,
        rerouteReason: 'auto_scaled',
        autoScaled: true,
    };
};


// ═══════════════════════════════════════════════════════════════════════════
//  DISCRETE-EVENT SIMULATION ENGINE (Realistic)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Runs an arrival-only simulation.
 * Requests are assigned over simulated time, but assigned load stays on the server
 * instead of being decremented later by completion events.
 */
const runDiscreteSimulation = (algorithm, requests, servers, baseCapacity) => {
    const steps = [];
    const logs = [];
    const latencies = [];
    const requestRouting = [];
    let state = {};

    const sortedRequests = requests
        .slice()
        .sort((a, b) => a.arrivalTime - b.arrivalTime);

    for (let i = 0; i < sortedRequests.length; i++) {
        const req = sortedRequests[i];

        const assignment = resolveServerAssignment(algorithm, req, servers, state, baseCapacity);
        const server = assignment.server;

        server.currentLoad += req.load;
        server.peakLoad = Math.max(server.peakLoad, server.currentLoad);
        server.activeConnections += 1;
        server.requestsHandled += 1;

        // Compute realistic latency including queueing
        const queueFactor = Math.max(1, 1 + ((server.currentLoad / server.maxCapacity) * 2));
        const realDuration = Math.round(req.duration * queueFactor * (server.baseLatency / 10));
        server.ewma = (0.3 * realDuration) + (0.7 * server.ewma);
        latencies.push(realDuration);

        requestRouting.push({
            reqId: req.id,
            serverId: server.serverId,
            preferredServerId: assignment.preferredServerId,
            rerouted: assignment.rerouted,
            rerouteReason: assignment.rerouteReason,
            load: req.load,
            arrivalTime: req.arrivalTime,
            activeConnections: server.activeConnections,
            assignedLoad: server.currentLoad,
            capacity: server.maxCapacity,
            usagePercent: +((server.currentLoad / server.maxCapacity) * 100).toFixed(1),
            autoScaled: assignment.autoScaled || server.autoScaled,
        });

        steps.push({
            type: 'arrival',
            reqId: req.id,
            load: req.load,
            serverId: server.serverId,
            preferredServerId: assignment.preferredServerId,
            rerouted: assignment.rerouted,
            rerouteReason: assignment.rerouteReason,
            autoScaled: assignment.autoScaled || server.autoScaled,
            serverSnapshot: {
                serverId: server.serverId,
                maxCapacity: server.maxCapacity,
                autoScaled: server.autoScaled,
            },
        });

        if (logs.length < 150) {
            if (assignment.rerouted && assignment.rerouteReason === 'capacity') {
                logs.push(`[${req.arrivalTime}ms] Request #${req.id} overflow on Server ${assignment.preferredServerId}, moved to Server ${server.serverId} (${server.currentLoad}/${server.maxCapacity})`);
            } else if (assignment.rerouted && assignment.rerouteReason === 'auto_scaled') {
                logs.push(`[${req.arrivalTime}ms] Auto-scaled Server ${server.serverId} added for Request #${req.id} (${server.currentLoad}/${server.maxCapacity})`);
            } else {
                logs.push(`[${req.arrivalTime}ms] Request #${req.id} assigned to Server ${server.serverId} (${server.currentLoad}/${server.maxCapacity})`);
            }
        }
    }

    return { steps, logs, latencies, requestRouting };
};


// ═══════════════════════════════════════════════════════════════════════════
//  METRICS COMPUTATION (Accurate)
// ═══════════════════════════════════════════════════════════════════════════

const computeMetrics = (servers, latencies, totalTime) => {
    const loads = servers.map(s => s.requestsHandled);
    const n = loads.length || 1;
    const avgLoad = loads.reduce((a, b) => a + b, 0) / n;

    // Jain's Fairness Index: F = (Σxi)² / (n · Σxi²)
    const sumLoads   = loads.reduce((a, b) => a + b, 0);
    const sumSqLoads = loads.reduce((a, b) => a + (b * b), 0);
    const fairnessIndex = sumSqLoads === 0
        ? 1    // If no requests, consider perfectly fair
        : (sumLoads * sumLoads) / (n * sumSqLoads);

    // Standard deviation
    const stdDev = Math.sqrt(loads.reduce((sum, l) => sum + Math.pow(l - avgLoad, 2), 0) / n);

    const overloadedCount = servers.filter(s => s.status === 'Overloaded').length;
    let efficiencyScore = Math.max(0, (fairnessIndex * 100) - (overloadedCount * 5)).toFixed(1);

    // Latency metrics
    const sortedLat = latencies.length ? [...latencies].sort((a, b) => a - b) : [0];
    const avgLatency = sortedLat.reduce((a, b) => a + b, 0) / (sortedLat.length || 1);
    const p50Latency = sortedLat[Math.floor(sortedLat.length * 0.50)] || 0;
    const p95Latency = sortedLat[Math.floor(sortedLat.length * 0.95)] || 0;
    const p99Latency = sortedLat[Math.floor(sortedLat.length * 0.99)] || 0;

    const throughput = totalTime > 0 ? (sortedLat.length / (totalTime / 1000)).toFixed(1) : 0;

    return {
        avgLoad:          +avgLoad.toFixed(1),
        maxLoad:          Math.max(...loads),
        minLoad:          Math.min(...loads),
        totalLoad:        sumLoads,
        overloadedCount,
        highCount:        servers.filter(s => s.status === 'High').length,
        stdDev:           +stdDev.toFixed(1),
        efficiencyScore:  +efficiencyScore,
        avgLatency:       +avgLatency.toFixed(1),
        p50Latency,
        p95Latency,
        p99Latency,
        throughput:       +throughput,
        fairnessIndex:    +fairnessIndex.toFixed(4),
    };
};


// ═══════════════════════════════════════════════════════════════════════════
//  HIGH-LEVEL SIMULATION RUNNER
// ═══════════════════════════════════════════════════════════════════════════

const runFullAlgorithm = (algorithmName, requests, numServers, serverCapacity, heterogeneous = false) => {
    const reqs = requests.map(r => ({ ...r }));
    const servers = initialServers(numServers, serverCapacity, heterogeneous);

    const { steps, logs, latencies, requestRouting } = runDiscreteSimulation(
        algorithmName, reqs, servers, serverCapacity
    );
    updateStatuses(servers);

    const maxTime = reqs.reduce((max, r) => Math.max(max, r.arrivalTime), 0) + 1000;
    const metrics = computeMetrics(servers, latencies, maxTime);

    return { servers, logs, steps, metrics, requestRouting };
};


// ═══════════════════════════════════════════════════════════════════════════
//  API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

// POST/GET /api/simulate
exports.runSimulation = async (req, res) => {
    try {
        const { algorithm } = req.query;
        const numServers     = parseInt(req.query.numServers)     || 4;
        const numRequests    = parseInt(req.query.numRequests)    || 200;
        const serverCapacity = parseInt(req.query.serverCapacity) || 1000;
        const heterogeneous  = req.query.heterogeneous === 'true';

        const requests = generateRequests(numRequests);
        const result = runFullAlgorithm(
            algorithm || 'roundrobin', requests, numServers, serverCapacity, heterogeneous
        );

        if (mongoose.connection.readyState === 1) {
            try {
                const doc = new SimulationResult({
                    userId: req.user?.id,
                    algorithm,
                    totalRequests: numRequests,
                    servers: result.servers,
                });
                await doc.save();
            } catch (saveError) {
                console.warn('MongoDB save skipped:', saveError.message);
            }
        }

        res.status(200).json({
            message: 'Simulation completed',
            algorithm,
            totalRequests: numRequests,
            servers:        result.servers,
            logs:           result.logs,
            steps:          result.steps,
            metrics:        result.metrics,
            requestRouting: result.requestRouting,
            requestSet:     requests,
        });
    } catch (error) {
        console.error('Simulation error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// GET /api/simulate/compare
exports.compareAlgorithms = async (req, res) => {
    try {
        const numServers     = parseInt(req.query.numServers)     || 4;
        const numRequests    = parseInt(req.query.numRequests)    || 200;
        const serverCapacity = parseInt(req.query.serverCapacity) || 1000;
        const heterogeneous  = req.query.heterogeneous === 'true';

        const requests = generateRequests(numRequests);

        const algoList = [
            'roundrobin', 'swrr', 'least', 'leastoutstanding',
            'p2c', 'p2cewma', 'iphash', 'ringhash',
            'maglev', 'hrw', 'localityaware',
            'random', 'weighted', 'jsq', 'jiq', 'sed',
            'boundedch', 'aperture', 'weightedrandomam',
        ];

        const results = {};
        let bestAlgo = null;
        let bestScore = -1;

        for (const algoName of algoList) {
            const r = runFullAlgorithm(algoName, requests, numServers, serverCapacity, heterogeneous);
            results[algoName] = { servers: r.servers, metrics: r.metrics };

            // Composite score: fairness * 0.6 + (1 - normalized latency) * 0.2 + efficiency * 0.2
            const latencyPenalty = Math.min(1, r.metrics.avgLatency / 200);
            const score =
                r.metrics.fairnessIndex * 0.6 +
                (1 - latencyPenalty) * 0.2 +
                (r.metrics.efficiencyScore / 100) * 0.2;

            if (score > bestScore) {
                bestScore = score;
                bestAlgo = algoName;
            }
        }

        res.status(200).json({
            message: 'Comparison completed',
            totalRequests: numRequests,
            numServers,
            serverCapacity,
            results,
            bestAlgorithm: bestAlgo,
        });
    } catch (error) {
        console.error('Comparison error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// GET /api/simulate/history
exports.getHistory = async (req, res) => {
    try {
        const history = await SimulationResult.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(3)
            .select('algorithm totalRequests createdAt')
            .lean();
        res.status(200).json({ history });
    } catch (error) {
        res.status(200).json({ history: [] });
    }
};
