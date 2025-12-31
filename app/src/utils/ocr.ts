import { recognizeTextCloud } from '../services/ocr-space';

export const recognizeText = async (imageFile: string | Blob): Promise<string> => {
    try {
        let base64Image = '';

        if (typeof imageFile === 'string') {
            base64Image = imageFile;
        } else {
            // Convert Blob to Base64
            base64Image = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(imageFile);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
            });
        }

        console.log("Sending to Cloud OCR...");
        const text = await recognizeTextCloud(base64Image);
        return text;

    } catch (error) {
        console.error("OCR Flow Failed:", error);
        throw error;
    }
};
