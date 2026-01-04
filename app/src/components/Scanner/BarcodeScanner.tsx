import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { motion } from 'framer-motion';

interface BarcodeScannerProps {
    onResult: (result: string) => void;
    onClose: () => void;
    onStatusChange?: (status: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onResult, onStatusChange }) => {
    const webcamRef = useRef<Webcam>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasNativeSupport, setHasNativeSupport] = useState<boolean>(true);
    const [scanning, setScanning] = useState(true);

    const checkSupport = useCallback(async () => {
        if (!('BarcodeDetector' in window)) {
            console.warn("Native BarcodeDetector not supported.");
            setHasNativeSupport(false);
            if (onStatusChange) onStatusChange("Live Scan Unavailable. Tap Circle to Photo-Scan.");
            return false;
        }
        return true;
    }, [onStatusChange]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        let detector: any;

        const startScanning = async () => {
            const supported = await checkSupport();
            if (!supported) return;

            try {
                // @ts-ignore - Native Chrome/Android API
                detector = new window.BarcodeDetector({
                    formats: ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
                });

                if (onStatusChange) onStatusChange("Searching...");

                interval = setInterval(async () => {
                    if (!webcamRef.current || !webcamRef.current.video || !scanning) return;

                    const video = webcamRef.current.video;
                    if (video.readyState !== 4) return;

                    try {
                        const barcodes = await detector.detect(video);
                        if (barcodes && barcodes.length > 0) {
                            const code = barcodes[0].rawValue;
                            if (code) {
                                console.log("Detected:", code);
                                setScanning(false);
                                if (onStatusChange) onStatusChange("Verified!");
                                onResult(code);
                                clearInterval(interval);
                            }
                        }
                    } catch (e) {
                        // Silent fail on frame
                    }
                }, 500); // 2FPS is enough for barcode

            } catch (e) {
                console.warn("BarcodeDetector Init Failed", e);
                setHasNativeSupport(false);
            }
        };

        startScanning();

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [checkSupport, onResult, onStatusChange, scanning]);


    return (
        <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
            {/* 1. WEBCAM FEED (Robust) */}
            <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                    facingMode: "environment",
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }}
                className="absolute inset-0 w-full h-full object-cover"
                onUserMedia={() => {
                    console.log("Webcam Started");
                    if (onStatusChange && hasNativeSupport) onStatusChange("Scanning...");
                }}
                onUserMediaError={(e) => {
                    console.error("Webcam Error", e);
                    setError("Camera Blocked. Check Permissions.");
                }}
            />

            {/* 2. OVERLAY UI */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">

                {/* SCAN FRAME */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-64 h-40 border-2 border-white/50 rounded-lg relative overflow-hidden bg-white/5"
                >
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-brand-500 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-brand-500 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-brand-500 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-brand-500 rounded-br-lg" />

                    {scanning && hasNativeSupport && (
                        <motion.div
                            className="absolute inset-x-0 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                            animate={{ top: ['0%', '100%', '0%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        />
                    )}
                </motion.div>

                {/* ERROR MESSAGE */}
                {error && (
                    <div className="absolute bottom-40 bg-red-600/90 text-white px-4 py-2 rounded-lg">
                        {error}
                    </div>
                )}

                {/* NO SUPPORT MESSAGE */}
                {!hasNativeSupport && !error && (
                    <div className="absolute top-32 bg-black/60 text-white/90 px-4 py-2 rounded-full text-xs backdrop-blur">
                        Live Scan Unavailable on this device.
                        <br />
                        <span className="font-bold text-brand-300">Use the White Button below to snap!</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BarcodeScanner;
