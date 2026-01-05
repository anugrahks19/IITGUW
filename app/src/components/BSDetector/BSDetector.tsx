import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ScanLine, RotateCcw } from 'lucide-react';

// Services
import { lookupProduct } from '../../services/product-lookup';
import { identifyProduct, analyzeImageWithAI } from '../../services/openrouter';
import type { AnalysisResult } from '../../services/openrouter';
import BarcodeScanner from '../Scanner/BarcodeScanner';

// Components
import { IntentSelector } from './IntentSelector';
import type { UserIntent } from './IntentSelector';
import { DecisionCard } from './DecisionCard';
import { ProvenanceModal } from './ProvenanceModal';
import { VoiceAssistant } from '../VoiceAssistant';

// Image Cropper
import ImageCropper from '../Scanner/ImageCropper';

// Types
type AppState = 'IDLE' | 'SCAN_BARCODE' | 'LOOKUP' | 'SCAN_FRONT' | 'SCAN_INGREDIENTS' | 'SCAN_CROP' | 'TRANSITION' | 'ANALYZING' | 'RESULT' | 'ERROR';

interface ScanData {
    barcode?: string;
    brand?: string;
    productName?: string;
    ingredientsText?: string;
    frontImage?: string; // base64
    ingredientsImage?: string; // base64
    analysis?: AnalysisResult;
    link?: string;
    forceFullScan?: boolean; // 🔒 New Flag
}

const BSDetector: React.FC = () => {
    const [state, setState] = useState<AppState>('SCAN_BARCODE'); // Default to Camera
    const [scanData, setScanData] = useState<ScanData>({});
    const [tempImage, setTempImage] = useState<string>(""); // For cropping
    const [cropTarget, setCropTarget] = useState<'FRONT' | 'INGREDIENTS'>('FRONT');
    // Logging reverted to console
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [loadingMsg, setLoadingMsg] = useState<string>('');
    const [userIntent, setUserIntent] = useState<UserIntent>('General Health');
    const [showProvenance, setShowProvenance] = useState(false);

    // Refs
    // Refs
    const webcamRef = useRef<Webcam>(null);
    const [scannerStatus, setScannerStatus] = useState("Scan Barcode");

    // Hardware Controls State

    // Hardware Controls State
    // Helper to toggle flashlight (TODO: Move to BarcodeScanner component)
    // const toggleTorch = ... (Removed for stability)

    // const toggleZoom = ... (Removed for stability)

    // ==========================================
    // Lifecycle & State Management
    // ==========================================

    // ==========================================
    // Lifecycle & State Management
    // ==========================================

    const resetFlow = () => {
        setScanData({});
        setErrorMsg('');
        setState('SCAN_BARCODE');
        setShowProvenance(false);
    };

    // ==========================================
    // Barcode Scanning Logic
    // ==========================================



    // 🗑️ REMOVED LEGACY SCANNER LOGIC (Conflicted with BarcodeScanner.tsx)
    // The component <BarcodeScanner /> now handles everything safely.

    // Unused helpers removed (startBarcodeScanner, loadExample)
    // Logic handled by BarcodeScanner component now.
    // Just process the result.
    const handleBarcodeDetected = async (barcode: string) => {

        setScanData(prev => ({ ...prev, barcode }));
        setState('LOOKUP');
        setLoadingMsg("Checking Database...");

        try {
            const product = await lookupProduct(barcode);
            if (product) {
                setScanData(prev => ({
                    ...prev,
                    brand: product.brand,
                    productName: product.productName,
                    ingredientsText: product.ingredientsText
                }));

                if (product.ingredientsText) {
                    startAnalysis({
                        ...scanData,
                        brand: product.brand,
                        productName: product.productName,
                        ingredientsText: product.ingredientsText
                    });
                } else {
                    // Need ingredients
                    setLoadingMsg("Ingredients missing. Switch to manual.");
                    safeSwitchTo('SCAN_INGREDIENTS');
                }
            } else {
                // Not found
                setLoadingMsg("No details found. Switching to visual scan...");
                // Use safe transition to allow camera to release
                setState('TRANSITION');
                setTimeout(() => setState('SCAN_FRONT'), 1200);
            }
        } catch (err) {
            console.error(err);
            setLoadingMsg("Network error. Switching to manual...");
            setState('TRANSITION');
            setTimeout(() => setState('SCAN_FRONT'), 1200);
        }
    };

    // Helper for safe camera switching
    const safeSwitchTo = (targetState: AppState) => {
        setState('TRANSITION');
        setTimeout(() => setState(targetState), 1200);
    };

    // ==========================================
    // Visual Scanning Logic (Webcam)
    // ==========================================

    const captureFront = async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        // Go to Crop Screen
        setTempImage(imageSrc);
        setCropTarget('FRONT');
        setState('SCAN_CROP');
    };

    const processFrontScan = async (imageSrc: string) => {
        setScanData(prev => ({ ...prev, frontImage: imageSrc }));
        setLoadingMsg("Identifying Product...");
        setState('LOOKUP');

        try {
            const result = await identifyProduct(imageSrc);

            // Update State with ID
            setScanData(prev => ({
                ...prev,
                brand: result.brand,
                productName: result.product,
                link: result.link
            }));

            // 🛑 SMART SKIP DISABLED (User Request for Reliability)
            // Fallback: Demand Scan
            setState('SCAN_INGREDIENTS');

        } catch (error) {
            console.error(error);
            setState('SCAN_INGREDIENTS'); // Just move on
        }
    };

    const captureIngredients = async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        // Go to Crop Screen
        setTempImage(imageSrc);
        setCropTarget('INGREDIENTS');
        setState('SCAN_CROP');
    };

    const handleCropComplete = (croppedImage: string) => {
        if (cropTarget === 'FRONT') {
            processFrontScan(croppedImage);
        } else {
            setScanData(prev => ({ ...prev, ingredientsImage: croppedImage }));
            startAnalysis({
                ...scanData,
                ingredientsImage: croppedImage
            }, true);
        }
    };

    // ==========================================
    // Analysis Logic
    // ==========================================

    const startAnalysis = async (data: ScanData, isImageAnalysis = false) => {
        console.log("Starting Analysis...", { intent: userIntent });
        setState('ANALYZING');
        setLoadingMsg(`Analyzing for ${userIntent}...`);

        try {
            let result;
            const contextName = `${data.brand || ''} ${data.productName || ''}`.trim();

            if (isImageAnalysis && data.ingredientsImage) {
                result = await analyzeImageWithAI(
                    data.ingredientsImage,
                    contextName,
                    data.ingredientsText,
                    userIntent // PASS INTENT HERE
                );
            } else if (data.ingredientsText) {
                const blankImg = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                result = await analyzeImageWithAI(blankImg, contextName, data.ingredientsText, userIntent);
            } else {
                throw new Error("No data");
            }

            console.log("Analysis OK", result.verdict);
            setScanData(prev => ({ ...prev, analysis: result }));
            setState('RESULT');
        } catch (error: any) {
            console.log("ERROR: Analysis Failed", error.message);
            console.error("[BSDetector] Analysis Failed", error);
            setErrorMsg(error?.message || "Could not analyze. Try again.");
            setState('ERROR');
        }
    };



    return (
        <div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans max-w-md mx-auto relative overflow-hidden">
            {/* Header */}
            <header className="fixed top-0 inset-x-0 p-6 z-[100] flex items-start justify-between pointer-events-none max-w-md mx-auto left-0 right-0">
                {state !== 'RESULT' ? (
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 shadow-lg pointer-events-auto">
                        <ScanLine className="w-4 h-4 text-brand-400" />
                        <span className="font-bold text-sm tracking-wide">ShelfSense</span>
                    </div>
                ) : <div />} {/* Spacer to keep Reset button to the right */}

                {state !== 'IDLE' && (
                    <button onClick={resetFlow} className="p-3 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 text-slate-300 shadow-lg hover:bg-black/80 transition-colors">
                        <RotateCcw className="w-4 h-4" />
                    </button>
                )}
            </header>

            <main className="flex-1 flex flex-col relative">
                <AnimatePresence mode="wait">

                    {/* IDLE state removed - App starts in Camera */}

                    {/* MAIN CAMERA VIEW - PERSISTENT */}
                    {(['SCAN_BARCODE', 'LOOKUP', 'SCAN_FRONT', 'SCAN_INGREDIENTS', 'SCAN_CROP', 'ANALYZING'].includes(state)) && (
                        <motion.div
                            key="scanner"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 bg-black relative flex flex-col"
                        >
                            {/* DYNAMIC GUIDE TEXT OVERLAY (Snapchat Style) */}
                            <div className="absolute top-32 inset-x-0 text-center pointer-events-none z-[60]">
                                <h2 className="text-4xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-tight animate-pulse"
                                    style={{ fontFamily: '"Inter", sans-serif', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                                    {state === 'SCAN_BARCODE' && scannerStatus}
                                    {state === 'LOOKUP' && loadingMsg}
                                    {state === 'SCAN_FRONT' && "Capture Front"}
                                    {state === 'SCAN_INGREDIENTS' && "Capture Ingredients"}
                                    {state === 'ANALYZING' && loadingMsg}
                                    {state === 'SCAN_CROP' && "Adjust Area"}
                                </h2>
                                {state === 'SCAN_BARCODE' && scannerStatus.includes("Scan") && (
                                    <p className="text-sm text-white/80 font-medium mt-2 drop-shadow-md">
                                        Point camera at code
                                    </p>
                                )}
                            </div>

                            {/* Intent Chip Overlay */}
                            {state !== 'SCAN_CROP' && <IntentSelector currentIntent={userIntent} onSelect={setUserIntent} />}

                            {/* CROPPER OVERLAY */}
                            {state === 'SCAN_CROP' && (
                                <ImageCropper
                                    imageSrc={tempImage}
                                    onCropComplete={handleCropComplete}
                                    onCancel={() => {
                                        // Return to previous state logic
                                        if (cropTarget === 'FRONT') setState('SCAN_FRONT');
                                        else setState('SCAN_INGREDIENTS');
                                    }}
                                />
                            )}


                            {/* BARCODE SCANNER OVERLAY */}
                            {/* BARCODE SCANNER + LIVE VIEW (Unmount during LOOKUP to free camera) */}
                            {(state === 'SCAN_BARCODE') && (
                                <div className="absolute inset-0 z-50 pointer-events-none">
                                    {/* LIVE SCANNER (Underneath, rendered by BarcodeScanner) */}
                                    <BarcodeScanner
                                        onResult={handleBarcodeDetected}
                                        onClose={() => { }}
                                        onStatusChange={setScannerStatus}
                                    />



                                    {/* 2. BOTTOM SHUTTER CONTROLS (Only in SCAN_BARCODE) */}
                                    {state === 'SCAN_BARCODE' && (
                                        <div className="absolute bottom-12 inset-x-0 flex flex-col items-center justify-center gap-4 pointer-events-auto">

                                            {/* SHUTTER BUTTON */}
                                            <button
                                                onClick={() => {
                                                    // MANUAL OVERRIDE: Switch to Visual Scan
                                                    // 1. Trigger Transition (closes scanner safely)
                                                    setState('TRANSITION');
                                                    // 2. Wait for hardware release -> Start Front Camera
                                                    setTimeout(() => setState('SCAN_FRONT'), 1200);
                                                }}
                                                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-90 transition-all bg-white/10 backdrop-blur-sm"
                                            >
                                                <div className="w-16 h-16 bg-white rounded-full" />
                                            </button>

                                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                                Tap to analyze package
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex-1 relative overflow-hidden rounded-b-3xl">
                                {/* Only render Webcam for specific visual states including ANALYZING */}
                                {['SCAN_FRONT', 'SCAN_INGREDIENTS', 'SCAN_CROP', 'ANALYZING'].includes(state) && (
                                    <Webcam
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        videoConstraints={{ facingMode: "environment" }}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onUserMediaError={(err) => {
                                            console.log("Webcam Mount ERROR", err);
                                            setErrorMsg("Camera busy. Please reset.");
                                            setState('ERROR');
                                        }}
                                    />
                                )}

                                {/* Image Cropper */}
                                {state === 'SCAN_CROP' && tempImage && (
                                    <ImageCropper
                                        imageSrc={tempImage}
                                        onCropComplete={handleCropComplete}
                                        onCancel={() => setState(cropTarget === 'FRONT' ? 'SCAN_FRONT' : 'SCAN_INGREDIENTS')}
                                    />
                                )}


                            </div>

                            {/* Controls */}
                            <div className="h-40 bg-black flex flex-col items-center justify-center relative z-20">
                                <p className="text-slate-400 text-sm mb-4">
                                    {state === 'SCAN_FRONT' ? "Snap Front Package" : "Snap Ingredients (Recommended) or Nutrition"}
                                </p>

                                <div className="flex items-center gap-8">
                                    {/* BARCODE TOGGLE */}
                                    <button
                                        onClick={() => setState('SCAN_BARCODE')}
                                        className="p-4 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-colors flex flex-col items-center gap-1"
                                    >
                                        <ScanLine className="w-6 h-6" />
                                        <span className="text-[10px]">Barcode</span>
                                    </button>

                                    <button
                                        onClick={state === 'SCAN_FRONT' ? captureFront : captureIngredients}
                                        className="w-20 h-20 rounded-full bg-white border-4 border-slate-300 flex items-center justify-center shadow-lg active:scale-90 transition-all"
                                    >
                                        <div className="w-16 h-16 bg-brand-500 rounded-full opacity-20" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* LOADING OVERLAY REMOVED - Camera stays visible with Guide Text */}

                    {/* RESULT (NEW SHELFSENSE UI) */}
                    {state === 'RESULT' && scanData.analysis && scanData.analysis.verdict ? (
                        <DecisionCard
                            result={scanData.analysis}
                            productName={scanData.productName || "Scanned Product"}
                            onSwap={() => {
                                // Mock Swap Action
                                window.open(`https://www.amazon.com/s?k=${encodeURIComponent(scanData.analysis?.swap_suggestion?.product_name || "Healthy Scan")}`, '_blank');
                            }}
                            onExplainMore={() => setShowProvenance(true)}
                        />
                    ) : state === 'RESULT' ? (
                        <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400">

                            <div>
                                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                                <p>Analysis Data Missing.</p>
                                <button onClick={resetFlow} className="mt-4 px-6 py-2 bg-slate-800 rounded-full text-white">Try Again</button>
                            </div>
                        </div>
                    ) : null}

                    {/* ERROR */}
                    {state === 'ERROR' && (
                        <div className="flex-1 flex items-center justify-center p-8 text-center">
                            <div>
                                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                <h3 className="text-xl font-bold">Something went wrong</h3>
                                <p className="text-slate-400 mb-6">{errorMsg}</p>
                                <button onClick={resetFlow} className="px-6 py-2 bg-slate-800 rounded-full">Try Again</button>
                            </div>
                        </div>
                    )}

                </AnimatePresence>

                {/* PROVENANCE MODAL */}
                <ProvenanceModal
                    isOpen={showProvenance}
                    onClose={() => setShowProvenance(false)}
                    result={scanData.analysis!}
                />

                {/* VOICE ASSISTANT (NIVU) */}
                <VoiceAssistant onNavigate={(action) => {
                    if (action === 'HOME') resetFlow();
                    else if (action === 'SCAN_BARCODE') setState('SCAN_BARCODE');
                    else if (action === 'SCAN_FRONT') safeSwitchTo('SCAN_FRONT');
                }} />
            </main>
        </div>
    );
};

export default BSDetector;
