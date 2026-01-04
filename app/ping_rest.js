const API_KEY = "AIzaSyCwUNAStgUm4Fu9mRqTWgROVw1FceXJ61Y";

async function testRest() {
    const models = ["gemini-1.5-flash", "gemini-pro", "gemini-1.0-pro"];
    const versions = ["v1beta", "v1"];

    for (const v of versions) {
        for (const m of models) {
            const url = `https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${API_KEY}`;
            console.log(`\nTesting ${v}/${m}...`);
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
                });
                const data = await response.json();
                if (response.ok) {
                    console.log(`✅ SUCCESS! (${v}/${m})`);
                    console.log(data);
                    return; // Stop if we find one
                } else {
                    console.log(`❌ FAILED: ${data.error?.message?.split('.')[0]}`);
                }
            } catch (e) {
                console.log("❌ Network Error");
            }
        }
    }
}

testRest();
