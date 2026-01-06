import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Brain, MessageSquare } from 'lucide-react';
import { chatWithNova } from '../../services/openrouter';



// Web Speech API Types
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

// Particle Component
const ParticleRing: React.FC<{ active: boolean, color: string }> = ({ active, color }) => {
    if (!active) return null;
    return (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {[...Array(6)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{
                        repeat: Infinity,
                        duration: 2,
                        delay: i * 0.3,
                        ease: "easeOut"
                    }}
                    className={`absolute w-full h-full rounded-full border ${color} opacity-40`}
                />
            ))}
            {[...Array(8)].map((_, i) => (
                <motion.div
                    key={`p-${i}`}
                    initial={{ x: 0, y: 0, opacity: 0 }}
                    animate={{
                        x: (Math.random() - 0.5) * 60,
                        y: (Math.random() - 0.5) * 60,
                        opacity: [0, 1, 0]
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 1.5 + Math.random(),
                        delay: Math.random() * 0.5,
                        ease: "circOut"
                    }}
                    className={`absolute w-1 h-1 rounded-full ${color.replace('border-', 'bg-')}`}
                />
            ))}
        </div>
    );
};

const Nova: React.FC<{ triggerCommand?: string | null, onCommandHandled?: () => void }> = ({ triggerCommand, onCommandHandled }) => {
    const [status, setStatus] = useState<'SLEEPING' | 'LISTENING' | 'PROCESSING' | 'SPEAKING'>('SLEEPING');
    const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [sentiment, setSentiment] = useState<'neutral' | 'positive' | 'negative' | 'caution'>('neutral');

    // Refs
    const recognition = useRef<any>(null);
    const isRunning = useRef(true);
    const silenceTimer = useRef<any>(null);
    const inactivityTimer = useRef<any>(null);
    const transcriptBuffer = useRef(""); // To accumulate speech over 5s

    // 15s Inactivity Timer (Go to Sleep if no response)
    const resetInactivityTimer = () => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (status === 'LISTENING') {
            inactivityTimer.current = setTimeout(() => {
                console.log("[Nexus] No response for 15s. Sleeping.");
                setStatus('SLEEPING');
            }, 15000);
        }
    };

    // 5s Silence Timer (User stopped speaking -> Process)
    const resetSilenceTimer = () => {
        if (silenceTimer.current) clearTimeout(silenceTimer.current);

        // Only set timer if we have something in the buffer
        if (transcriptBuffer.current.trim().length > 0 && status === 'LISTENING') {
            silenceTimer.current = setTimeout(async () => {
                console.log("[Nexus] 5s Silence Detected. Processing...");
                const fullCommand = transcriptBuffer.current.trim();
                if (fullCommand) {
                    setStatus('PROCESSING');
                    transcriptBuffer.current = ""; // Clear buffer
                    await processCommand(fullCommand);
                }
            }, 5000);
        }
    };

    useEffect(() => {
        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
        const SpeechRecognitionClass = SpeechRecognition || webkitSpeechRecognition;

        if (!SpeechRecognitionClass) return;

        const recognizer = new SpeechRecognitionClass();
        recognizer.continuous = true;
        recognizer.interimResults = true;
        recognizer.lang = 'en-US';

        recognizer.onstart = () => {
            console.log("[Nexus] Recognition Started");
        };

        recognizer.onresult = (event: any) => {
            // IMPORTANT: Reset sleep timer on ANY noise
            resetInactivityTimer();
            if (status !== 'LISTENING') return;

            let interim = '';
            let newFinal = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    newFinal += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }

            // Append final bits to our main buffer
            if (newFinal) {
                transcriptBuffer.current += " " + newFinal;
                console.log("[Nexus] Buffered Final:", newFinal);
            }

            // Update UI with (Buffer + Interim) so user sees live feedback
            const liveText = (transcriptBuffer.current + " " + interim).trim();
            if (liveText) {
                // Reset the "Done Speaking" timer since we are getting results
                resetSilenceTimer();
            }
        };

        recognizer.onend = () => {
            // If it stops randomly, restart it if we are supposed to be running
            if (isRunning.current && status !== 'SLEEPING') {
                console.log("[Nexus] Restarting Recognizer...");
                setTimeout(() => { try { recognizer.start(); } catch (e) { } }, 100);
            }
        };

        recognizer.onerror = (e: any) => {
            console.warn("[Nexus] Error:", e.error);
        };

        recognition.current = recognizer;

        return () => {
            isRunning.current = false;
            recognizer.stop();
        };
    }, [status]); // Re-bind if status changes (specifically for logic checks)

    // Manage Recognizer State based on Status
    useEffect(() => {
        if (status === 'SLEEPING') {
            try { recognition.current?.stop(); } catch (e) { }
            transcriptBuffer.current = "";
        } else if (status === 'LISTENING') {
            isRunning.current = true;
            try { recognition.current?.start(); } catch (e) { }
            resetInactivityTimer(); // Start the 15s countdown immediately
        }
    }, [status]);

    // Handle External Triggers (e.g., Chips)
    useEffect(() => {
        if (triggerCommand && status !== 'PROCESSING' && status !== 'SPEAKING') {
            console.log("[Nexus] Triggered Externally:", triggerCommand);
            setStatus('PROCESSING');
            processCommand(triggerCommand);
            onCommandHandled?.();
        }
    }, [triggerCommand]);

    const processCommand = async (command: string) => {
        try {
            const fullResponse = await chatWithNova(command, history);

            // 🧠 PARSE RESPONSE (Split Speech | Chips)
            const [speechText, ...chips] = fullResponse.split('|');
            const cleanSpeech = speechText.trim();
            const cleanChips = chips.map(c => c.trim()).filter(c => c.length > 0);

            // 🧠 SENTIMENT ANALYSIS (Simple Keyword Match)
            const lower = cleanSpeech.toLowerCase();
            if (lower.includes('avoid') || lower.includes('unhealthy') || lower.includes('bad') || lower.includes('high sugar')) {
                setSentiment('negative');
            } else if (lower.includes('healthy') || lower.includes('good') || lower.includes('great') || lower.includes('excellent')) {
                setSentiment('positive');
            } else if (lower.includes('moderate') || lower.includes('caution') || lower.includes('limit')) {
                setSentiment('caution');
            } else {
                setSentiment('neutral');
            }

            setSuggestions(cleanChips);
            setHistory(prev => [...prev, { role: 'user', content: command }, { role: 'assistant', content: cleanSpeech }].slice(-10));
            speak(cleanSpeech);
        } catch (error) {
            console.error(error);
            setStatus('LISTENING'); // Go back to listening if error
        }
    };

    const speak = (text: string) => {
        setStatus('SPEAKING');
        const utter = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const techVoice = voices.find(v => v.name.includes("Google US English")) || voices[0];
        if (techVoice) utter.voice = techVoice;
        utter.rate = 1.1;

        utter.onend = () => {
            // Cycle back to listening for follow-up
            setStatus('LISTENING');
            transcriptBuffer.current = "";
            resetInactivityTimer(); // Start 15s wait for follow-up
        };

        window.speechSynthesis.speak(utter);
    };

    // UI HELPER
    const getOrbState = () => {
        switch (status) {
            case 'SLEEPING':
                return {
                    color: 'border-cyan-400 bg-cyan-950',
                    ring: 'border-cyan-400/20',
                    shadow: 'shadow-[0_0_15px_rgba(34,211,238,0.3)]',
                    scale: 1,
                    icon: <Zap className="w-4 h-4 text-cyan-400" />
                };
            case 'LISTENING':
                return {
                    color: 'border-cyan-400 bg-cyan-500',
                    ring: 'border-cyan-400',
                    shadow: 'shadow-[0_0_30px_rgba(34,211,238,0.6)]',
                    scale: 1.1,
                    icon: <Zap className="w-4 h-4 text-white" />
                };
            case 'PROCESSING':
                return {
                    color: 'border-purple-400 bg-purple-500',
                    ring: 'border-purple-400',
                    shadow: 'shadow-[0_0_30px_rgba(168,85,247,0.6)]',
                    scale: 1.1,
                    icon: <Brain className="w-4 h-4 text-white animate-spin" />
                };
            case 'SPEAKING':
                // Dynamic Color based on Sentiment
                let speakColor = 'border-cyan-300 bg-cyan-400';
                if (sentiment === 'positive') speakColor = 'border-green-300 bg-green-400 shadow-[0_0_40px_rgba(74,222,128,0.8)]';
                if (sentiment === 'negative') speakColor = 'border-red-300 bg-red-400 shadow-[0_0_40px_rgba(248,113,113,0.8)]';
                if (sentiment === 'caution') speakColor = 'border-yellow-300 bg-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.8)]';

                return {
                    color: speakColor,
                    ring: sentiment === 'positive' ? 'border-green-300' : sentiment === 'negative' ? 'border-red-300' : 'border-cyan-300',
                    shadow: 'shadow-[0_0_40px_rgba(103,232,249,0.8)]',
                    scale: [1, 1.2, 1], // Heartbeat/Talking Animation handled in motion prop
                    icon: <MessageSquare className="w-4 h-4 text-white" />
                };
        }
    };

    const ui = getOrbState();

    return (
        <div className="relative flex items-center justify-center">
            {/* Thinking Bubble */}
            <AnimatePresence>
                {status !== 'SLEEPING' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, x: "-50%", scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
                        exit={{ opacity: 0, y: 10, x: "-50%", scale: 0.8 }}
                        className="fixed bottom-32 left-1/2 -translate-x-1/2 w-auto min-w-[150px] max-w-[85vw] bg-black/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 z-[100] shadow-2xl flex flex-col items-center justify-center"
                    >
                        <p className="text-xs text-cyan-400 font-mono text-center leading-relaxed break-words whitespace-pre-wrap">
                            {status === 'LISTENING' ? 'LISTENING...' :
                                status === 'PROCESSING' ? 'THINKING...' :
                                    status === 'SPEAKING' ? 'ANSWERING...' : '...'}
                        </p>

                        {/* SUGGESTION CHIPS (Silent Follow-up) */}
                        {suggestions.length > 0 && status !== 'PROCESSING' && (
                            <div className="flex flex-wrap justify-center gap-2 mt-3 pt-3 border-t border-white/10">
                                {suggestions.map((chip, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setStatus('PROCESSING');
                                            processCommand(chip);
                                        }}
                                        className="text-[10px] bg-white/10 hover:bg-white/20 text-cyan-200 px-2 py-1 rounded-full transition-colors border border-white/5"
                                    >
                                        {chip}
                                    </button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Particle Background: Only when NOT SLEEPING */}
            <ParticleRing active={status !== 'SLEEPING'} color={ui.ring} />

            {/* THE ORB */}
            <motion.div
                animate={{
                    scale: status === 'SPEAKING' ? [1, 1.15, 1] : ui.scale,
                }}
                transition={status === 'SPEAKING' ? {
                    repeat: Infinity,
                    duration: 0.4, // Fast talking pulse
                    ease: "easeInOut"
                } : { type: "spring", stiffness: 300, damping: 20 }}
                className={`w-16 h-16 rounded-full flex items-center justify-center relative z-10 border-2 ${ui.color} ${ui.shadow} transition-colors duration-300 cursor-pointer`}
                onClick={() => {
                    if (status === 'SLEEPING') { setStatus('LISTENING'); /* Silent Wake */ }
                    else { setStatus('SLEEPING'); }
                }}
            >
                {ui.icon}
            </motion.div>
        </div>
    );
};

export default Nova;
