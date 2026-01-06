import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Brain, MessageSquare } from 'lucide-react';
import { chatWithNova } from '../../services/openrouter';

const WAKE_WORD = "nexus";

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

const Nova: React.FC = () => {
    const [status, setStatus] = useState<'SLEEPING' | 'LISTENING' | 'PROCESSING' | 'SPEAKING'>('SLEEPING');
    const [transcript, setTranscript] = useState("");
    const [history, setHistory] = useState<{ role: string; content: string }[]>([]);

    // Refs
    const recognition = useRef<any>(null);
    const isRunning = useRef(true);
    const watchdogTimer = useRef<any>(null);
    const inactivityTimer = useRef<any>(null);
    const hasGreeted = useRef(false);

    // Activity reset for auto-sleep
    const resetInactivityTimer = () => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (status !== 'SLEEPING') {
            inactivityTimer.current = setTimeout(() => {
                console.log("[Nexus] Auto-sleep.");
                setStatus('SLEEPING');
            }, 20000);
        }
    };

    const kickWatchdog = () => {
        if (watchdogTimer.current) clearTimeout(watchdogTimer.current);
        watchdogTimer.current = setTimeout(() => {
            if (isRunning.current && status === 'LISTENING') {
                console.log("[Nexus] Watchdog: No input for 8s (Silent)");
            }
        }, 8000);
    };

    useEffect(() => {
        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
        const SpeechRecognitionClass = SpeechRecognition || webkitSpeechRecognition;

        if (!SpeechRecognitionClass) return;

        const recognizer = new SpeechRecognitionClass();
        recognizer.continuous = true;
        recognizer.interimResults = true;
        recognizer.lang = 'en-US';

        recognizer.onstart = () => { kickWatchdog(); };

        recognizer.onresult = async (event: any) => {
            kickWatchdog();
            resetInactivityTimer();

            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (interimTranscript && status !== 'SLEEPING') {
                setTranscript(interimTranscript);
            }

            if (finalTranscript) {
                const text = finalTranscript.trim();
                const lower = text.toLowerCase();

                if (lower.includes(WAKE_WORD)) {
                    setStatus('LISTENING');
                    setTranscript("Listening...");

                    const command = lower.split(WAKE_WORD)[1] || "";

                    // 1. FIRST TIME INTRO
                    if (!hasGreeted.current) {
                        hasGreeted.current = true;
                        speak("Hello, I am Nexus. I am listening.");
                        return;
                    }

                    // 2. WAIT FOR ME TO SAY
                    if (command.trim().length > 10) {
                        setStatus('PROCESSING');
                        await processCommand(command.trim());
                    }
                } else if (status === 'LISTENING') {
                    // Fallback: If we are already LISTENING, any text is a command
                    setStatus('PROCESSING');
                    await processCommand(text);
                }
            }
        };

        recognizer.onend = () => {
            if (isRunning.current) {
                setTimeout(() => { try { recognizer.start(); } catch (e) { } }, 100);
            }
        };

        recognizer.onerror = () => { };

        recognition.current = recognizer;
        try { recognizer.start(); } catch (e) { }

        return () => {
            isRunning.current = false;
        };
    }, [status]);

    const processCommand = async (command: string) => {
        try {
            const response = await chatWithNova(command, history);
            setHistory(prev => [...prev, { role: 'user', content: command }, { role: 'assistant', content: response }].slice(-10));
            speak(response);
        } catch (error) {
            setStatus('SLEEPING');
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
            setStatus('LISTENING');
            resetInactivityTimer();
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
                return {
                    color: 'border-cyan-300 bg-cyan-400',
                    ring: 'border-cyan-300',
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
                        initial={{ opacity: 0, y: -10, x: "-50%", scale: 0.8 }}
                        animate={{ opacity: 1, y: 10, x: "-50%", scale: 1 }}
                        exit={{ opacity: 0, x: "-50%", scale: 0.8 }}
                        className="absolute top-full mt-2 left-1/2 whitespace-nowrap bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 z-50"
                    >
                        <p className="text-[10px] text-cyan-400 font-mono tracking-wider">
                            {status === 'PROCESSING' ? 'THINKING...' : transcript || 'LISTENING'}
                        </p>
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
