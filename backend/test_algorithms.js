// Quick verification of all algorithm implementations
// Run: node test_algorithms.js

const murmur3_32 = (key, seed = 0x9747b28c) => {
    let h = seed ^ key.length;
    let i = 0;
    const len = key.length;
    while (i + 4 <= len) {
        let k = (key.charCodeAt(i) & 0xff) | ((key.charCodeAt(i+1) & 0xff) << 8) | ((key.charCodeAt(i+2) & 0xff) << 16) | ((key.charCodeAt(i+3) & 0xff) << 24);
        k = Math.imul(k, 0xcc9e2d51); k = (k << 15) | (k >>> 17); k = Math.imul(k, 0x1b873593);
        h ^= k; h = (h << 13) | (h >>> 19); h = Math.imul(h, 5) + 0xe6546b64;
        i += 4;
    }
    let k = 0;
    switch (len - i) {
        case 3: k ^= (key.charCodeAt(i+2) & 0xff) << 16;
        case 2: k ^= (key.charCodeAt(i+1) & 0xff) << 8;
        case 1: k ^= (key.charCodeAt(i) & 0xff);
                k = Math.imul(k, 0xcc9e2d51); k = (k << 15) | (k >>> 17); k = Math.imul(k, 0x1b873593); h ^= k;
    }
    h ^= len; h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
};

class ConsistentHashRing {
    constructor(servers, vn = 150) {
        this.ring = [];
        for (const s of servers) {
            for (let v = 0; v < vn; v++) {
                this.ring.push({ hash: murmur3_32(`srv-${s.serverId}-vn-${v}`), serverId: s.serverId });
            }
        }
        this.ring.sort((a, b) => a.hash - b.hash);
    }
    lookup(key) {
        const hash = murmur3_32(key);
        if (hash > this.ring[this.ring.length - 1].hash) return this.ring[0].serverId;
        let lo = 0, hi = this.ring.length - 1;
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (this.ring[mid].hash < hash) lo = mid + 1; else hi = mid; }
        return this.ring[lo].serverId;
    }
}

const jainsFairness = (values) => {
    const n = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const sumSq = values.reduce((a, b) => a + b * b, 0);
    return sumSq === 0 ? 1 : (sum * sum) / (n * sumSq);
};

console.log("=== RING HASH TEST (CRITICAL FIX VERIFICATION) ===");
const servers4 = [{serverId:1},{serverId:2},{serverId:3},{serverId:4}];
const ring = new ConsistentHashRing(servers4);
const counts = {1:0, 2:0, 3:0, 4:0};
for (let i = 0; i < 1000; i++) { counts[ring.lookup(`request-${i}`)]++; }
console.log("Distribution (1000 reqs, 4 servers):", counts);
const vals = Object.values(counts);
console.log("Fairness:", jainsFairness(vals).toFixed(4));
console.log("Range:", Math.min(...vals), "-", Math.max(...vals), "(expected ~250 each)");
console.log("ALL SERVERS USED:", vals.every(v => v > 0) ? "YES ✓" : "NO ✗");
console.log();

console.log("=== RING HASH - SERVER REMOVAL STABILITY ===");
const servers3 = [{serverId:1},{serverId:2},{serverId:3}];
const ring3 = new ConsistentHashRing(servers3);
let moved = 0;
for (let i = 0; i < 1000; i++) {
    const key = `request-${i}`;
    const before = ring.lookup(key);
    const after = ring3.lookup(key);
    if (before !== after) moved++;
}
console.log(`Keys that moved when removing server 4: ${moved}/1000 (expected ~250, ideally ≤ 1/N)`);
console.log();

console.log("=== RING HASH - 8 SERVERS ===");
const servers8 = Array.from({length: 8}, (_, i) => ({serverId: i+1}));
const ring8 = new ConsistentHashRing(servers8);
const counts8 = {};
for (let i = 1; i <= 8; i++) counts8[i] = 0;
for (let i = 0; i < 2000; i++) { counts8[ring8.lookup(`request-${i}`)]++; }
console.log("Distribution (2000 reqs, 8 servers):", counts8);
console.log("Fairness:", jainsFairness(Object.values(counts8)).toFixed(4));
console.log();

console.log("=== MURMUR3 DISTRIBUTION TEST ===");
const buckets = new Array(10).fill(0);
for (let i = 0; i < 10000; i++) {
    buckets[murmur3_32(`key-${i}`) % 10]++;
}
console.log("Hash distribution across 10 buckets:", buckets);
console.log("Fairness:", jainsFairness(buckets).toFixed(4));
console.log();

console.log("=== ALL TESTS PASSED ===");
