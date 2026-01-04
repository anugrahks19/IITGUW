import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';

interface BarcodeScannerProps {
    onResult: (barcode: string) => void;
    onClose: () => void;
    onStatusChange?: (status: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onResult, onStatusChange }) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [error, setError] = useState<string>("");
    const didInit = useRef(false);

    // Stability & Tracking State
    const scanCountRef = useRef(0);
    const lastCodeRef = useRef("");
    const [trackingRect, setTrackingRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [scanProgress, setScanProgress] = useState(0); // 0 to 5

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;

        const scannerId = "reader-stream";
        const html5QrCode = new Html5Qrcode(scannerId);
        scannerRef.current = html5QrCode;

        // 📸 CAMERA CONFIGS
        const config4K = {
            fps: 15,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
            videoConstraints: {
                facingMode: { ideal: "environment" },
                width: { min: 640, ideal: 1920, max: 3840 },
                height: { min: 480, ideal: 1080, max: 2160 },
                advanced: [{ focusMode: "continuous" }] as any[]
            },
        };

        const configBasic = {
            fps: 15,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
            videoConstraints: {
                facingMode: "environment" // Minimal constraint
            },
        };

        const startScanner = async () => {
            // 🔒 HTTPS CHECK
            if (!window.isSecureContext) {
                setError("⚠️ Camera requires HTTPS. Mobile browsers block it on HTTP.");
                // Still try to start (might work on localhost), but warn.
            }

            try {
                // 1️⃣ TRY PRO MODE (4K / Focus)
                console.log("📸 Trying Pro Camera Mode...");
                await html5QrCode.start({ facingMode: "environment" }, config4K, onScanSuccess, onScanFailure);
            } catch (err: any) {
                console.warn("⚠️ Pro Camera Failed:", err);

                try {
                    // 2️⃣ FALLBACK TO BASIC MODE (Compatibility)
                    console.log("🔄 Fallback to Basic Camera Mode...");
                    await html5QrCode.start({ facingMode: "environment" }, configBasic, onScanSuccess, onScanFailure);
                } catch (err2: any) {
                    console.error("❌ Basic Camera Failed:", err2);
                    handleCameraError(err2);
                }
            }
        };

        const onScanSuccess = (decodedText: string, result: any) => {
            // --- 1. COORDINATE MAPPING ---
            if (result?.resultPoints && result.resultPoints.length > 0) {
                calculateBoundingBox(result.resultPoints);
            } else {
                setTrackingRect(null);
            }

            // --- 2. STABILITY LOGIC ---
            if (decodedText !== lastCodeRef.current) {
                lastCodeRef.current = decodedText;
                scanCountRef.current = 1;
                setScanProgress(1);
                onStatusChange?.("Detecting Barcode...");
            } else {
                scanCountRef.current += 1;
                setScanProgress(Math.min(scanCountRef.current, 5));
                if (scanCountRef.current < 5) {
                    onStatusChange?.("Scanning...");
                }
            }

            // --- 3. FINAL VALIDATION (5 Frames) ---
            if (scanCountRef.current === 5) {
                onStatusChange?.("Verified!");
                setTimeout(() => {
                    stopScanner(html5QrCode).then(() => {
                        onResult(decodedText);
                    });
                }, 2000);
            }
        };

        const onScanFailure = (_: any) => {
            setTrackingRect(null);
        };

        const handleCameraError = (err: any) => {
            if (err?.name === "NotAllowedError") {
                setError("🚫 Camera Permission Denied. Please reset permissions in browser settings.");
            } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
                setError("📷 No Camera Found on this device.");
            } else if (err?.name === "NotReadableError") {
                setError("⚠️ Camera is in use by another app.");
            } else if (err?.name === "OverconstrainedError") {
                setError("⚠️ Camera constraints not supported.");
            } else {
                setError(`Camera Error: ${err.message || "Unknown error"}`);
            }
        };

        startScanner();

        return () => {
            if (html5QrCode.isScanning) {
                stopScanner(html5QrCode);
            }
        };
    }, []);

    const calculateBoundingBox = (points: Array<any>) => {
        // Points are in Video Source Coordinates
        const videoElement = document.querySelector("#reader-stream video") as HTMLVideoElement;
        if (!videoElement) return;

        const videoW = videoElement.videoWidth;
        const videoH = videoElement.videoHeight;
        const clientW = videoElement.clientWidth;
        const clientH = videoElement.clientHeight;

        if (videoW === 0 || videoH === 0) return;

        // "object-fit: cover" Logic
        const scale = Math.max(clientW / videoW, clientH / videoH);

        const drawnW = videoW * scale;
        // const drawnH = videoH * scale; // Unused
        const offX = (clientW - drawnW) / 2;
        const offY = (clientH - (videoH * scale)) / 2;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        const x = minX * scale + offX;
        const y = minY * scale + offY;
        const w = (maxX - minX) * scale;
        const h = (maxY - minY) * scale;

        setTrackingRect({ x, y, w, h });
    };

    const stopScanner = async (instance: Html5Qrcode) => {
        try {
            if (instance.isScanning) {
                await instance.stop();
            }
            instance.clear();
        } catch (err) {
            console.warn("Stop Warning", err);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-0 bg-black flex items-center justify-center pointer-events-none"
        >
            {/* Viewport */}
            <div id="reader-stream" className="w-full h-full absolute inset-0 object-cover pointer-events-auto" />

            {/* TRACKING OVERLAY */}
            <AnimatePresence>
                {/* Show if we have a rect OR if we have progress (fallback) */}
                {scanProgress > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            // If tracking, use pixels. If fallback, use 0 and rely on CSS centering.
                            x: trackingRect ? trackingRect.x : 0,
                            y: trackingRect ? trackingRect.y : 0,
                            width: trackingRect ? trackingRect.w : 250,
                            height: trackingRect ? trackingRect.h : 150,
                            left: trackingRect ? 0 : '50%',
                            top: trackingRect ? 0 : '50%',
                            translateX: trackingRect ? 0 : '-50%',
                            translateY: trackingRect ? 0 : '-50%'
                        }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.1, ease: "easeOut" }}
                        className="absolute z-20 pointer-events-none"
                    >
                        {/* Animated Border Box */}
                        <div className="w-full h-full relative">
                            {/* Base Border */}
                            <div className="absolute inset-0 border-2 border-white/50 rounded-lg" />

                            {/* Progress Border (Fills up) */}
                            <motion.div
                                className={`absolute inset-0 border-[4px] rounded-lg shadow-[0_0_20px_rgba(255,165,0,0.6)] ${scanProgress === 5 ? 'border-green-500 shadow-green-500/50' : 'border-brand-500'}`}
                                initial={{ clipPath: 'inset(0 100% 0 0)' }}
                                animate={{ clipPath: `inset(0 ${100 - (scanProgress * 20)}% 0 0)` }}
                                transition={{ duration: 0.1 }}
                            />

                            {/* Scanning Scanline inside the box */}
                            <div className="absolute inset-0 overflow-hidden rounded-lg opacity-30">
                                <div className={`w-full h-[50%] bg-gradient-to-b animate-scan-fast ${scanProgress === 5 ? 'from-green-500/0 via-green-500/50 to-green-500/0' : 'from-brand-500/0 via-brand-500/50 to-brand-500/0'}`} />
                            </div>
                        </div>

                        {/* Label */}
                        <div className="absolute -top-6 left-0 right-0 flex justify-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${scanProgress === 5 ? 'bg-green-500 text-black' : 'bg-brand-500 text-black'}`}>
                                {scanProgress === 5 ? "SCANNED!" : "DETECTING..."}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ERROR OVERLAY */}
            {error && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
                    <div className="text-red-500 text-6xl mb-4">⚠️</div>
                    <h3 className="text-white text-xl font-bold mb-2">Camera Disabled</h3>
                    <p className="text-red-400 text-lg mb-4">{error}</p>
                    <p className="text-gray-400 text-sm">
                        Mobile browsers block the camera on insecure connections (HTTP).
                        <br />
                        <strong>Solution:</strong> Deploy this app to Vercel (HTTPS).
                    </p>
                </div>
            )}
        </motion.div>
    );
};

export default BarcodeScanner;
