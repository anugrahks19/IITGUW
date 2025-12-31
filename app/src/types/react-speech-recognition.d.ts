declare module 'react-speech-recognition' {
    export interface SpeechRecognition {
        startListening: (options?: { continuous?: boolean; language?: string }) => Promise<void>;
        stopListening: () => Promise<void>;
        abortListening: () => Promise<void>;
        browserSupportsSpeechRecognition: boolean;
    }

    export const useSpeechRecognition: () => {
        transcript: string;
        listening: boolean;
        resetTranscript: () => void;
        browserSupportsSpeechRecognition: boolean;
        isMicrophoneAvailable: boolean;
    };

    const SpeechRecognition: SpeechRecognition;
    export default SpeechRecognition;
}
