import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, ExternalLink } from 'lucide-react';
import type { AnalysisResult } from '../../services/openrouter';

interface ProvenanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: AnalysisResult;
}

export const ProvenanceModal: React.FC<ProvenanceModalProps> = ({ isOpen, onClose, result }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 20 }} // Slight gap from bottom
                        exit={{ y: "100%" }}
                        className="fixed inset-x-0 bottom-0 top-20 bg-slate-900 rounded-t-3xl border-t border-white/10 z-50 p-6 shadow-2xl overflow-hidden flex flex-col"
                    >
                        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-6 shrink-0" />

                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-brand-400" />
                                Reasoning Chain
                            </h2>
                            <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-6 pb-12">
                            {/* SECTION 1: SOURCES */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Knowledge Sources</h3>
                                <div className="space-y-2">
                                    {result.sources_cited && result.sources_cited.length > 0 ? (
                                        result.sources_cited.map((source, i) => (
                                            <div key={i} className="flex gap-3 p-3 bg-slate-800/50 rounded-lg text-sm text-slate-300 border border-white/5">
                                                <div className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold shrink-0">
                                                    {i + 1}
                                                </div>
                                                {source}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-slate-500 text-sm italic">General Nutrition Knowledge Base</div>
                                    )}
                                </div>
                            </div>

                            {/* SECTION 2: RAW UNCERTAINTY */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Confidence Breakdown</h3>
                                <div className="p-4 bg-slate-800/30 rounded-xl border border-white/5 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Data Quality</span>
                                        <span className={result.uncertainty.score > 80 ? 'text-green-400' : 'text-yellow-400'}>
                                            {result.uncertainty.score}%
                                        </span>
                                    </div>
                                    <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                                        <div className={`h-full ${result.uncertainty.score > 80 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${result.uncertainty.score}%` }} />
                                    </div>
                                    {result.uncertainty.reason && (
                                        <p className="text-xs text-slate-500 pt-2 border-t border-white/5 mt-2">
                                            FLAG: {result.uncertainty.reason}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* SECTION 3: SYSTEM PROMPT (Fun "Under the hood" peek) */}
                            <div className="opacity-50 hover:opacity-100 transition-opacity">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">AI Context</h3>
                                <div className="p-3 bg-black rounded-lg text-xs font-mono text-green-300/60 overflow-x-auto whitespace-pre-wrap">
                                    {`Intent: "${localStorage.getItem('shelfSense_intent') || 'General'}"\nModel: ${result.model_used || "Auto-Switch"}\nMode: Agentic Decision`}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
