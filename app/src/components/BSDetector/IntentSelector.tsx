import React from 'react';
import { motion } from 'framer-motion';
import { Leaf, Activity, DollarSign, XCircle, Heart } from 'lucide-react';

export type UserIntent = 'General Health' | 'Vegan' | 'Keto' | 'Low Sugar' | 'Budget' | 'Nut Allergy';

interface IntentSelectorProps {
    currentIntent: UserIntent;
    onSelect: (intent: UserIntent) => void;
}

const INTENTS: { id: UserIntent, icon: React.ReactNode, label: string }[] = [
    { id: 'General Health', icon: <Heart className="w-4 h-4" />, label: "General" },
    { id: 'Low Sugar', icon: <Activity className="w-4 h-4" />, label: "Low Sugar" },
    { id: 'Vegan', icon: <Leaf className="w-4 h-4" />, label: "Vegan" },
    { id: 'Nut Allergy', icon: <XCircle className="w-4 h-4" />, label: "No Nuts" },
    { id: 'Budget', icon: <DollarSign className="w-4 h-4" />, label: "Budget" },
];

export const IntentSelector: React.FC<IntentSelectorProps> = ({ currentIntent, onSelect }) => {
    return (
        <div className="absolute top-20 left-0 right-0 z-30 px-6 pointer-events-none">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2 overflow-x-auto pb-2 scrollbar-none pointer-events-auto"
            >
                {INTENTS.map((item) => {
                    const isActive = currentIntent === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onSelect(item.id)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl border transition-all text-sm font-medium whitespace-nowrap shadow-lg
                                ${isActive
                                    ? 'bg-brand-500/90 text-white border-brand-400 shadow-brand-500/20'
                                    : 'bg-black/60 text-slate-300 border-white/10 hover:bg-black/80'}
                            `}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    );
                })}
            </motion.div>
        </div>
    );
};
