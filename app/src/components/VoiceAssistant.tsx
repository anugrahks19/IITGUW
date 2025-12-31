import React, { useState, useEffect, useRef } from 'react';
import { Mic, Volume2, Loader2 } from 'lucide-react';
import { chatWithNivu } from '../services/openrouter';

interface VoiceProps {
    onNavigate: (action: string) => void;
}

// 🛠️ Type Definitions for Native Web Speech API
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

type Mode = 'SLEEP' | 'AWAKE';

export const VoiceAssistant: React.FC<VoiceProps> = ({ onNavigate }) => {
    // STATE
    const [mode, setMode] = useState<Mode>('SLEEP');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [error, setError] = useState('');

    // REFS
    const recognitionRef = useRef<any>(null);
    const modeRef = useRef<Mode>('SLEEP');
    const awakeTimerRef = useRef<any>(null); // The 15s "Conversation Window"
    const isSpeakingRef = useRef(false);
    const isProcessingRef = useRef(false);
    const hasGreetedRef = useRef(false); // Track if we've said hello

    // Sync Ref
    useEffect(() => { modeRef.current = mode; }, [mode]);

    useEffect(() => {
        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
        const SpeechAPI = SpeechRecognition || webkitSpeechRecognition;

        if (SpeechAPI) {
            const recognition = new SpeechAPI();
            recognition.continuous = true; // We keep it continuous WHILE AWAKE
            recognition.interimResults = true;
            recognition.lang = 'en-IN';

            recognition.onstart = () => {
                console.log("🎤 Mic Started");
                setError('');
                // If we started, we are effectively AWAKE (or transitioning)
            };

            recognition.onresult = (event: any) => {
                // If Nivu is talking, ignore inputs (Soft Echo Cancellation)
                if (isSpeakingRef.current) return;

                let currentTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                }

                const cleanText = currentTranscript.trim();
                setTranscript(currentTranscript);

                // If we hear speech, RESET the 15s Timer (Keep the conversation alive)
                if (modeRef.current === 'AWAKE') {
                    resetAwakeTimer();
                    debouncedProcess(cleanText);
                }
            };

            recognition.onerror = (event: any) => {
                console.error("🎤 Mic Error:", event.error);
                if (event.error === 'not-allowed') {
                    setError("Mic Denied");
                    hardStop();
                }
            };

            recognition.onend = () => {
                console.log("🎤 Mic Stopped");

                // AUTO-RESTART LOGIC (Only if AWAKE)
                // If we are supposed to be AWAKE, but the browser killed the mic (silence/network),
                // we restart it to keep the "15s Window" open.
                if (modeRef.current === 'AWAKE' && !error) {
                    try { recognition.start(); } catch (e) { }
                }
            };

            recognitionRef.current = recognition;
        }

        return () => {
            if (recognitionRef.current) recognitionRef.current.abort();
            clearTimeout(awakeTimerRef.current);
        };
    }, []);

    // ⏳ THE 15-SECOND WINDOW
    const resetAwakeTimer = () => {
        if (awakeTimerRef.current) clearTimeout(awakeTimerRef.current);

        console.log("⏳ Timer Reset: 8s remaining...");
        awakeTimerRef.current = setTimeout(() => {
            // If this triggers, it means 8s of TOTAL SILENCE.
            console.log("💤 Timeout! Going to Sleep.");
            goSleep();
        }, 8000); // 8 Seconds
    };

    const goWake = () => {
        setMode('AWAKE');
        modeRef.current = 'AWAKE';
        setResponse("");
        setTranscript("Listening...");

        try { recognitionRef.current?.start(); } catch (e) { }

        // GREETING LOGIC
        if (!hasGreetedRef.current) {
            speak("Hey there, I am Nivu, your personal assistant.");
            hasGreetedRef.current = true;
        } else {
            speak("I'm listening.");
        }

        resetAwakeTimer(); // Start the first 15s window
    };

    const goSleep = () => {
        speak("Going to sleep."); // Polite goodbye
        hardStop();
    };

    const hardStop = () => {
        setMode('SLEEP');
        modeRef.current = 'SLEEP';

        if (awakeTimerRef.current) clearTimeout(awakeTimerRef.current);

        // Kill Mic
        try { recognitionRef.current?.stop(); } catch (e) { }
        setIsListening(false);
    };

    // 🧠 PROCESSING LOGIC
    const processingTimerRef = useRef<any>(null);
    const debouncedProcess = (text: string) => {
        if (processingTimerRef.current) clearTimeout(processingTimerRef.current);

        // Wait 1.5s silence to confirm "End of Turn"
        processingTimerRef.current = setTimeout(() => {
            if (text.length > 2 && !isProcessingRef.current) {
                handleFinalInput(text);
            }
        }, 1500);
    };

    const handleFinalInput = async (text: string) => {
        // Commands
        if (text.toLowerCase().includes('stop')) {
            window.speechSynthesis.cancel();
            return;
        }
        if (text.toLowerCase().includes('scan')) {
            onNavigate('SCAN_BARCODE');
            return;
        }

        console.log("🧠 Processing:", text);
        setIsProcessing(true);
        isProcessingRef.current = true;
        setTranscript(""); // Clear transcript during processing instead of showing "Thinking..."

        try {
            const answer = await chatWithNivu(text);
            setResponse(answer);
            speak(answer);
            // Note: Timer is NOT reset here, it's reset when speech ENDS (in speak function)
        } catch (e) {
            speak("I couldn't connect.");
        } finally {
            setIsProcessing(false);
            isProcessingRef.current = false;
        }
    };

    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();

            // Pause "Silence Timer" while Nivu is talking
            if (awakeTimerRef.current) clearTimeout(awakeTimerRef.current);

            setIsSpeaking(true);
            isSpeakingRef.current = true;

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.1;

            utterance.onend = () => {
                setIsSpeaking(false);
                isSpeakingRef.current = false;

                // If we are AWAKE, we restart the 15s "Waiting for Reply" timer
                if (modeRef.current === 'AWAKE') {
                    resetAwakeTimer();
                }
            };

            window.speechSynthesis.speak(utterance);
        }
    };

    // TOGGLE CLICK
    const handleOrbClick = () => {
        if (mode === 'SLEEP') {
            goWake();
        } else {
            // If Awake, manual tap puts to sleep immediately
            speak("Okay, stopping.");
            hardStop();
        }
    };

    return (
        <div className={`fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2 transition-all duration-300 ${mode === 'AWAKE' ? 'opacity-100' : 'opacity-80'}`}>

            {/* TEXT BUBBLE */}
            {(transcript || response || error) && mode === 'AWAKE' && (
                <div className="mb-2 max-w-[200px] bg-black/90 backdrop-blur-xl text-white p-4 rounded-3xl border border-white/10 text-sm shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                    {error && <p className="text-red-400 font-bold mb-1">{error}</p>}

                    {transcript && !error && (
                        <p className="text-gray-300 italic mb-2">"{transcript}"</p>
                    )}

                    {response && !isProcessing && (
                        <p className="font-semibold text-white leading-relaxed">{response}</p>
                    )}

                    {isProcessing && (
                        <div className="flex items-center gap-2 text-brand-400 font-medium">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Thinking...
                        </div>
                    )}
                </div>
            )}

            {/* ACTION ORB */}
            <div
                className={`
                    relative w-16 h-16 rounded-full flex items-center justify-center
                    transition-all duration-300 shadow-2xl cursor-pointer ring-4 active:scale-95
                    ${mode === 'SLEEP'
                        ? 'bg-red-500 ring-red-900/20 shadow-red-500/20' // SLEEP (Red) - No grayscale, kept red as requested
                        : isSpeaking
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 ring-emerald-400/50 shadow-emerald-500/50 scale-110' // TALKING
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 ring-blue-400/50 animate-pulse shadow-blue-500/50' // LISTENING (Awake)
                    }
                `}
                onClick={handleOrbClick}
            >
                {mode === 'SLEEP' ? (
                    <Mic className="text-white w-8 h-8 opacity-90" /> // Mic Icon explicitly requested
                ) : isSpeaking ? (
                    <Volume2 className="text-white w-8 h-8" />
                ) : isProcessing ? (
                    <Loader2 className="text-white w-8 h-8 animate-spin" />
                ) : (
                    <Mic className="text-white w-8 h-8" />
                )}
            </div>

        </div>
    );
};
