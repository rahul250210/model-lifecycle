import React, { useState, useEffect } from 'react';
import { Dialog, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

interface ImageModalProps {
    open: boolean;
    onClose: () => void;
    images?: string[]; // Array of image URLs
    initialIndex?: number; // Starting index
    imageUrl?: string; // Fallback for single image (backward compatibility)
    altText?: string;
}

const ImageModal: React.FC<ImageModalProps> = ({ open, onClose, images, initialIndex = 0, imageUrl, altText }) => {
    // Combine props to get a unified list of images
    const imageList = images || (imageUrl ? [imageUrl] : []);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Sync internal state when popup opens or props change
    useEffect(() => {
        if (open) {
            setCurrentIndex(initialIndex);
        }
    }, [open, initialIndex]);

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex > 0) {
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrentIndex((prev) => prev - 1);
                setIsTransitioning(false);
            }, 150);
        }
    };

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex < imageList.length - 1) {
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrentIndex((prev) => prev + 1);
                setIsTransitioning(false);
            }, 150);
        }
    };

    // Keyboard navigation
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' && currentIndex > 0) handlePrev();
            if (e.key === 'ArrowRight' && currentIndex < imageList.length - 1) handleNext();
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, imageList.length, onClose, currentIndex]);

    if (imageList.length === 0) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xl"
            PaperProps={{
                sx: {
                    bgcolor: 'transparent',
                    boxShadow: 'none',
                    overflow: 'visible', // Allow buttons to hang slightly outside if needed
                    borderRadius: 0,
                    maxWidth: '95vh',
                    maxHeight: '95vh',
                    margin: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }
            }}
            BackdropProps={{
                sx: {
                    backdropFilter: 'blur(12px)',
                    bgcolor: 'rgba(0, 0, 0, 0.85)',
                }
            }}
        >
            {/* Click anywhere outside the image container to close */}
            <Box onClick={onClose} sx={{ position: 'absolute', inset: 0, zIndex: 0 }} />

            {/* Main Content Container - Fits the image */}
            <Box
                sx={{
                    position: 'relative',
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    outline: 'none',
                }}
                onClick={(e) => e.stopPropagation()} // Prevent clicks near image from closing
            >
                {/* Close Button - Top Right of the image */}
                <IconButton
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        top: -40,
                        right: -40,
                        color: 'rgba(255,255,255,0.9)',
                        bgcolor: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        width: 40,
                        height: 40,
                        '&:hover': { bgcolor: 'rgba(200, 50, 50, 0.8)', color: '#fff', transform: 'scale(1.1)' },
                        transition: 'all 0.2s ease',
                        zIndex: 20,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>

                {/* Left Arrow - Floating on the left edge */}
                <IconButton
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    sx={{
                        position: 'absolute',
                        left: -74, // Slight overlap/hang
                        color: 'rgba(255,255,255,0.9)',
                        bgcolor: 'rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        width: 48,
                        height: 48,
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)', transform: 'scale(1.1)' },
                        '&.Mui-disabled': { opacity: 0, pointerEvents: 'none' },
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        zIndex: 20,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                >
                    <ArrowBackIosNewIcon fontSize="small" />
                </IconButton>

                {/* Image Wrapper */}
                <Box
                    sx={{
                        position: 'relative',
                        display: 'flex',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.8)',
                        opacity: isTransitioning ? 0 : 1,
                        transform: isTransitioning ? 'scale(0.98)' : 'scale(1)',
                        transition: 'all 0.2s ease-out',
                        bgcolor: '#000', // Black bg for letterboxing if any
                    }}
                >
                    <img
                        src={imageList[currentIndex]}
                        alt={altText || `Image ${currentIndex + 1}`}
                        style={{
                            display: 'block', // Remove inline-block gap
                            maxWidth: '100%',
                            maxHeight: '85vh',
                            objectFit: 'contain',
                        }}
                    />

                    {/* Image Counter - Bottom Center Overlay */}
                    {imageList.length > 1 && (
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 6,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                px: 1.5,
                                py: 0.5,
                                borderRadius: '20px',
                                bgcolor: 'rgba(0, 0, 0, 0.6)',
                                backdropFilter: 'blur(4px)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.9)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                letterSpacing: '0.05em',
                                pointerEvents: 'none',
                            }}
                        >
                            {currentIndex + 1} / {imageList.length}
                        </Box>
                    )}
                </Box>

                {/* Right Arrow - Floating on the right edge */}
                <IconButton
                    onClick={handleNext}
                    disabled={currentIndex === imageList.length - 1}
                    sx={{
                        position: 'absolute',
                        right: -74, // Slight overlap/hang
                        color: 'rgba(255,255,255,0.9)',
                        bgcolor: 'rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        width: 48,
                        height: 48,
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)', transform: 'scale(1.1)' },
                        '&.Mui-disabled': { opacity: 0, pointerEvents: 'none' },
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        zIndex: 20,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                >
                    <ArrowForwardIosIcon fontSize="small" />
                </IconButton>
            </Box>
        </Dialog>
    );
};

export default ImageModal;
