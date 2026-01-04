import https from 'https';

// Manual Key 
const API_KEY = "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";
const MODEL = "google/gemma-3-12b-it:free";

console.log(`Testing OpenRouter Connectivity with model: ${MODEL}...`);

const data = JSON.stringify({
    model: MODEL,
    messages: [{ role: "user", content: "Ping" }]
});

const options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://localhost',
        'X-Title': 'Connectivity Test'
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log(`\n--- RESPONSE ---`);
        console.log(`Status Code: ${res.statusCode}`);
        console.log("Body:", body);
    });
});

req.on('error', (e) => {
    console.error(`❌ NETWORK ERROR: ${e.message}`);
});

req.write(data);
req.end();
