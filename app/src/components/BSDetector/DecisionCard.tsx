import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, XCircle, ArrowRight, RefreshCw, BarChart2, ScanLine } from 'lucide-react';
import type { AnalysisResult } from '../../services/openrouter';

interface DecisionCardProps {
    result: AnalysisResult;
    productName: string;
    onSwap: () => void;
    onExplainMore: () => void;
    onScanIngredients: () => void;
    onAskQuestion: (q: string) => void;
    userIntent: string;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({ result, productName, onSwap, onExplainMore, onScanIngredients, onAskQuestion, userIntent }) => {
    console.log("[DecisionCard] Rendered with result:", result);
    const isGood = result.verdict === 'HEALTHY';
    const isBad = result.verdict === 'AVOID' || result.verdict === 'UNHEALTHY';
    const isMid = result.verdict === 'MODERATE';

    const color = isGood ? 'text-green-400' : isBad ? 'text-red-400' : 'text-yellow-400';
    const bg = isGood ? 'bg-green-500' : isBad ? 'bg-red-500' : 'bg-yellow-500';

    // Only show swap if swap exists AND product is not 'HEALTHY'
    const showSwap = result.swap_suggestion && !isGood;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-950 pb-20">
            {/* 1. HERO VERDICT */}
            <div className="relative pt-12 pb-8 px-6 text-center">
                <div className={`absolute top-0 inset-x-0 h-40 ${bg} opacity-10 blur-3xl`} />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative z-10 flex flex-col items-center"
                >
                    {/* PRODUCT NAME HEADER */}
                    <div className="mb-6 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                            {productName || "Unknown Product"}
                        </span>
                    </div>

                    <div className={`inline-flex items-center justify-center p-4 rounded-full bg-slate-900 border-2 ${isGood ? 'border-green-500/50' : isBad ? 'border-red-500/50' : 'border-yellow-500/50'} mb-4 shadow-2xl`}>
                        {isGood && <CheckCircle className={`w-12 h-12 ${color}`} />}
                        {isBad && <XCircle className={`w-12 h-12 ${color}`} />}
                        {isMid && <AlertTriangle className={`w-12 h-12 ${color}`} />}
                    </div>

                    <h1 className={`text-3xl font-black uppercase tracking-tight mb-2 ${color} drop-shadow-lg`}>
                        {result.verdict.replace('_', ' ')}
                    </h1>

                    <p className="text-xl font-medium text-slate-200 leading-snug max-w-xs mx-auto">
                        {result.verdict_short}
                    </p>

                    {/* SMART UNKNOWN HANDLING */}
                    {productName.toLowerCase().includes('unknown') && (
                        <motion.button
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            onClick={onScanIngredients}
                            className="mt-6 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-full shadow-lg shadow-brand-500/20 flex items-center gap-2 animate-pulse"
                        >
                            <ScanLine className="w-4 h-4" />
                            Scan Ingredients Label
                        </motion.button>
                    )}
                </motion.div>
            </div>

            {/* 2. UNCERTAINTY (Humanized) */}
            {/* 2. UNCERTAINTY BAR + Humanized Text */}
            <div className="px-8 mb-6">
                {/* Visual Bar */}
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-mono uppercase tracking-widest">
                    <BarChart2 className="w-3 h-3" />
                    Confidence: {100 - Math.round(result.uncertainty.score)}%
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-3">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${100 - result.uncertainty.score}%` }}
                        className={`h-full ${100 - result.uncertainty.score > 80 ? 'bg-brand-500' : 'bg-yellow-500'}`}
                    />
                </div>

                {/* Humanized Note if needed */}
                {result.uncertainty.score > 20 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2 text-center"
                    >
                        <p className="text-xs text-yellow-300 italic">
                            "I had a bit of trouble reading the bottom of the label, but I'm confident about these main ingredients."
                        </p>
                    </motion.div>
                )}
            </div>

            {/* 3. WHY & TRADEOFFS */}
            <div className="px-6 space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
                        Why it matters for <span className="text-brand-400">{userIntent}</span>
                    </h3>
                    <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                        {result.explanation}
                    </p>

                    {/* Compact Pros/Cons (Safe Access) */}
                    <div className="space-y-2">
                        {result.tradeoffs?.cons?.slice(0, 2).map((con, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-red-200/80">
                                <span className="mt-1.5 w-1 h-1 bg-red-500 rounded-full shrink-0" />
                                {con}
                            </div>
                        ))}
                        {result.tradeoffs?.pros?.slice(0, 2).map((pro, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-green-200/80">
                                <span className="mt-1.5 w-1 h-1 bg-green-500 rounded-full shrink-0" />
                                {pro}
                            </div>
                        ))}
                    </div>

                    {/* FOLLOW UP QUESTIONS CHIPS */}
                    {result.followUpQuestions && result.followUpQuestions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/5">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ask Niva</p>
                            <div className="flex flex-wrap gap-2">
                                {result.followUpQuestions.slice(0, 3).map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => onAskQuestion(q)}
                                        className="text-xs text-brand-200 bg-brand-900/30 border border-brand-500/30 px-3 py-1.5 rounded-full hover:bg-brand-900/50 transition-colors text-left"
                                    >
                                        "{q}"
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. SWAP ACTION (The MVP Feature) */}
                {showSwap && (
                    <motion.div
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-r from-brand-600 to-indigo-600 rounded-2xl p-1 shadow-lg shadow-brand-900/50"
                    >
                        <div className="bg-slate-900/40 rounded-xl p-4 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold uppercase text-brand-200 tracking-wider flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3" /> Better Choice
                                </span>
                                <span className="text-xs font-bold text-green-400 bg-green-900/30 px-2 py-0.5 rounded">
                                    {result.swap_suggestion?.savings}
                                </span>
                            </div>

                            <h4 className="font-bold text-lg text-white mb-1">
                                {result.swap_suggestion?.product_name}
                            </h4>
                            <p className="text-sm text-brand-100/70 mb-3">
                                {result.swap_suggestion?.reason_why}
                            </p>

                            <button onClick={onSwap} className="w-full py-3 bg-white text-brand-900 font-bold rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-all text-sm">
                                Find on Amazon <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* 5. SOURCES TRIGGER */}
                <button
                    onClick={onExplainMore}
                    className="w-full py-4 text-slate-500 text-xs text-center hover:text-slate-300 transition-colors"
                >
                    View Logic & Sources
                </button>
            </div>
        </div>
    );
};
