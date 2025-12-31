import React, { useState, useRef } from 'react';
import ReactCrop, { centerCrop } from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Check, X } from 'lucide-react';

interface ImageCropperProps {
    imageSrc: string;
    onCropComplete: (croppedImage: string) => void;
    onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCropComplete, onCancel }) => {
    // 🛡️ Initialize with a valid crop to prevent crash
    const [crop, setCrop] = useState<Crop>({
        unit: '%',
        x: 0,
        y: 0,
        width: 100,
        height: 100
    });
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const imgRef = useRef<HTMLImageElement>(null);

    // Initial load: Set a default crop covering 80% of the image
    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        const initialCrop = centerCrop(
            {
                unit: '%',
                width: 80,
                height: 50,
                x: 10,
                y: 25
            },
            width,
            height
        );
        setCrop(initialCrop);
    };

    const getCroppedImg = async (image: HTMLImageElement, crop: PixelCrop): Promise<string> => {
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        canvas.width = crop.width * scaleX;
        canvas.height = crop.height * scaleY;

        const ctx = canvas.getContext('2d');
        if (!ctx) return "";

        ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height
        );

        return canvas.toDataURL('image/jpeg', 0.95);
    };

    const handleConfirm = async () => {
        if (completedCrop && imgRef.current) {
            try {
                const croppedImage = await getCroppedImg(imgRef.current, completedCrop);
                onCropComplete(croppedImage);
            } catch (e) {
                console.error("Crop failed", e);
            }
        } else {
            // If no crop, just return original? Or block?
            // Let's assume user wants entire image if they didn't touch it, 
            // but relying on 'completedCrop' ensures we have coords.
            // If completedCrop is empty, we can just return imageSrc.
            if (imgRef.current) {
                // Return basically the whole image
                onCropComplete(imageSrc);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-300">
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-black/95">
                <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    className="max-h-[80vh] w-auto"
                >
                    <img
                        ref={imgRef}
                        alt="Crop me"
                        src={imageSrc}
                        onLoad={onImageLoad}
                        style={{ maxHeight: '80vh', objectFit: 'contain' }}
                        crossOrigin="anonymous"
                    />
                </ReactCrop>
            </div>

            {/* Controls */}
            <div className="h-24 bg-zinc-900 border-t border-white/10 px-8 flex items-center justify-between">
                <button
                    onClick={onCancel}
                    className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors"
                >
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                        <X className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium">Cancel</span>
                </button>

                <div className="text-center">
                    <p className="text-white font-semibold text-sm">Adjust Selection</p>
                    <p className="text-slate-400 text-xs text-nowrap">Drag corners to crop</p>
                </div>

                <button
                    onClick={handleConfirm}
                    className="flex flex-col items-center gap-1 text-brand-400 hover:text-brand-300 transition-colors"
                >
                    <div className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-900/50">
                        <Check className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium">Done</span>
                </button>
            </div>
        </div>
    );
};

export default ImageCropper;
