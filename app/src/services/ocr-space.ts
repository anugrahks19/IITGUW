const API_KEY = import.meta.env.VITE_OCR_SPACE_KEY;

export const recognizeTextCloud = async (base64Image: string): Promise<string> => {
    if (!API_KEY) {
        throw new Error("Missing OCR.space API Key");
    }

    // Ensure base64 string doesn't have the header "data:image/jpeg;base64," for some APIs, 
    // but OCR.space usually accepts the full data URI or just the payload.
    // Documentation says: base64Image - "data:image/jpg;base64,..."

    const formData = new FormData();
    formData.append('base64Image', base64Image);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2'); // Engine 2 is better for numbers/special characters

    try {
        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            headers: {
                'apikey': API_KEY
            },
            body: formData
        });

        const data = await response.json();

        if (data.IsErroredOnProcessing) {
            throw new Error(data.ErrorMessage?.[0] || "OCR Parsing Error");
        }

        if (!data.ParsedResults || data.ParsedResults.length === 0) {
            return "";
        }

        // Combine text from all parsed regions
        return data.ParsedResults.map((result: any) => result.ParsedText).join('\n');

    } catch (error) {
        console.error("Cloud OCR Failed:", error);
        throw new Error("Failed to read text from the cloud API.");
    }
};
