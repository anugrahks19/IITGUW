import https from 'https';

const API_KEY = "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";
const MODEL = "google/gemma-3-12b-it:free";

const systemContext = `
You are Nivu, a calm, human-like food decision co-pilot.
CORE VOICE RULES:
1. Speak in SHORT, confident sentences.
2. First give a clear judgment (Good / Okay / Avoid).
3. Then explain why it matters in this situation.
4. Always mention uncertainty honestly.
5. NEVER sound alarmist.
`;

const messages = [
    { role: "system", content: systemContext },
    { role: "user", content: "Is this apple healthy?" }
];

console.log(`Testing Nivu Chat with ${MODEL}...`);

const req = https.request({
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://shelf-sense.vercel.app', // Site URL
        'X-Title': 'ShelfSense'
    }
}, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
            console.log("Response:", body);
        } else {
            const json = JSON.parse(body);
            console.log("Nivu says:", json.choices[0].message.content);
        }
    });
});

req.write(JSON.stringify({
    model: MODEL,
    messages: messages
}));
req.end();
