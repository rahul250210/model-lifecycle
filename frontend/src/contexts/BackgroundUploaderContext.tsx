import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from '../api/axios';
import { Box, Typography, LinearProgress, IconButton, Paper, Stack, alpha } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useTheme } from '../theme/ThemeContext';

interface UploadTask {
    id: string; // unique ID for the task
    context: 'version' | 'algorithm';
    versionId?: number;
    versionNumber?: number;
    files: File[];
    type: 'dataset' | 'label' | 'algorithm_artifact'; // Added generic type
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
    uploadedCount: number;
    totalCount: number;

    // Context info for the API
    factoryId?: number;
    algorithmId?: number;
    modelId?: number;
    dismissed?: boolean;
}

interface BackgroundUploaderContextType {
    queueUpload: (
        factoryId: number,
        algorithmId: number,
        modelId: number,
        versionId: number,
        versionNumber: number,
        files: File[],
        type: 'dataset' | 'label'
    ) => void;
    queueAlgorithmUpload: (
        algorithmId: number,
        files: File[]
    ) => void;
    tasks: UploadTask[];
    clearTask: (taskId: string) => void;
    cancelUploadsForVersion: (versionId: number) => void;
}

const BackgroundUploaderContext = createContext<BackgroundUploaderContextType | undefined>(undefined);

export const useBackgroundUploader = () => {
    const context = useContext(BackgroundUploaderContext);
    if (!context) {
        throw new Error('useBackgroundUploader must be used within a BackgroundUploaderProvider');
    }
    return context;
};

export const BackgroundUploaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { theme } = useTheme();
    const [tasks, setTasks] = useState<UploadTask[]>([]);
    const processingRef = useRef<boolean>(false);
    const cancelledVersionsRef = useRef<Set<number>>(new Set());

    // Chunk size for batched uploads (increased for performance)
    const CHUNK_SIZE = 250;

    const queueUpload = (
        factoryId: number,
        algorithmId: number,
        modelId: number,
        versionId: number,
        versionNumber: number,
        files: File[],
        type: 'dataset' | 'label'
    ) => {
        const newTask: UploadTask = {
            id: `${versionId}-${type}-${Date.now()}`,
            context: 'version',
            versionId,
            versionNumber,
            files,
            type,
            progress: 0,
            status: 'pending',
            uploadedCount: 0,
            totalCount: files.length,
            factoryId,
            algorithmId,
            modelId
        };

        // Remove from cancelled set if re-queued (though unlikely for same ID)
        if (cancelledVersionsRef.current.has(versionId)) {
            cancelledVersionsRef.current.delete(versionId);
        }

        setTasks(prev => [...prev, newTask]);
    };

    const queueAlgorithmUpload = (
        algorithmId: number,
        files: File[]
    ) => {
        const newTask: UploadTask = {
            id: `algo-${algorithmId}-${Date.now()}`,
            context: 'algorithm',
            algorithmId,
            files,
            type: 'algorithm_artifact',
            progress: 0,
            status: 'pending',
            uploadedCount: 0,
            totalCount: files.length
        };
        setTasks(prev => [...prev, newTask]);
    };

    const clearTask = (taskId: string) => {
        setTasks(prev => prev.map(t => {
            if (t.id === taskId) {
                // If it's already done/error, remove it fully.
                // If it's uploading/pending, just dismiss from UI (hide).
                if (t.status === 'completed' || t.status === 'error') {
                    return null; // Will filter out below
                }
                return { ...t, dismissed: true };
            }
            return t;
        }).filter((t): t is UploadTask => t !== null));
    };

    const cancelUploadsForVersion = (versionId: number) => {
        // 1. Signal the worker calls to stop
        cancelledVersionsRef.current.add(versionId);

        // 2. Mark pending/uploading tasks as Error in UI immediately
        setTasks(prev => prev.map(t => {
            if (t.context === 'version' && t.versionId === versionId && (t.status === 'pending' || t.status === 'uploading')) {
                return {
                    ...t,
                    status: 'error',
                    error: "Upload cancelled: Version deleted"
                };
            }
            return t;
        }));
    };

    // Worker effect
    useEffect(() => {
        const processQueue = async () => {
            if (processingRef.current) return;

            // Find next pending task - IGNORE dismissed status for processing (files should still upload)
            const nextTaskIdx = tasks.findIndex(t => t.status === 'pending');
            if (nextTaskIdx === -1) return;

            const task = tasks[nextTaskIdx];

            // Check if pre-cancelled (only for version uploads)
            if (task.context === 'version' && task.versionId && cancelledVersionsRef.current.has(task.versionId)) {
                setTasks(prev => {
                    const newTasks = [...prev];
                    newTasks[nextTaskIdx] = {
                        ...newTasks[nextTaskIdx],
                        status: 'error',
                        error: "Upload cancelled: Version deleted"
                    };
                    return newTasks;
                });
                return;
            }

            processingRef.current = true;

            // Update status to uploading
            setTasks(prev => {
                const newTasks = [...prev];
                newTasks[nextTaskIdx] = { ...newTasks[nextTaskIdx], status: 'uploading' };
                return newTasks;
            });

            try {
                // Process in chunks
                const totalFiles = task.files.length;
                let uploaded = 0;

                for (let i = 0; i < totalFiles; i += CHUNK_SIZE) {
                    // STOP if version was cancelled mid-upload
                    if (task.context === 'version' && task.versionId && cancelledVersionsRef.current.has(task.versionId)) {
                        throw new Error("Upload cancelled: Version deleted");
                    }

                    const chunk = task.files.slice(i, i + CHUNK_SIZE);

                    let url = '';
                    const formData = new FormData(); // Declared here

                    if (task.context === 'version') {
                        url = `/factories/${task.factoryId}/algorithms/${task.algorithmId}/models/${task.modelId}/versions/${task.versionId}/upload_chunk`;
                        formData.append("artifact_type", task.type);
                    } else {
                        // Algorithm Knowledge Base upload (bulk supported directly, but let's chunk it for consistency if needed)
                        // The endpoint /kb/algorithms/{id}/files supports standard file upload
                        url = `/kb/algorithms/${task.algorithmId}/files`;
                    }

                    chunk.forEach(f => {
                        // PRESERVE STRUCTURE: Use webkitRelativePath if available to keep folder structure
                        const filename = (f as any).webkitRelativePath || f.name;
                        formData.append("files", f, filename);
                    });

                    await axios.post(
                        url,
                        formData,
                        {
                            // 5 minutes timeout per chunk for massive files
                            timeout: 300000
                        }
                    );

                    uploaded += chunk.length;

                    // Update progress
                    setTasks(prev => {
                        const idx = prev.findIndex(t => t.id === task.id);
                        if (idx === -1) return prev; // Task removed?

                        // Also check cancellation here to update UI state if needed, 
                        // though the catch block will handle the 'error' status eventually.

                        const updated = [...prev];
                        updated[idx] = {
                            ...updated[idx],
                            uploadedCount: uploaded,
                            progress: Math.min(100, Math.round((uploaded / totalFiles) * 100))
                        };
                        return updated;
                    });

                    // Small delay to prevent UI freezing and yield to event loop
                    await new Promise(resolve => setTimeout(resolve, 50));
                }

                // Complete
                setTasks(prev => {
                    const idx = prev.findIndex(t => t.id === task.id);
                    if (idx === -1) return prev;

                    // Double check cancellation before marking complete (race condition)
                    if (task.context === 'version' && task.versionId && cancelledVersionsRef.current.has(task.versionId)) {
                        const updated = [...prev];
                        updated[idx] = { ...updated[idx], status: 'error', error: "Upload cancelled: Version deleted" };
                        return updated;
                    }

                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], status: 'completed', progress: 100 };
                    return updated;
                });

            } catch (err: any) {
                console.error("Upload failed", err);
                // If 404, it means the version was deleted on the server
                const isNotFound = err.response?.status === 404;
                const isCancelled = err.message === "Upload cancelled: Version deleted" ||
                    (task.context === 'version' && task.versionId && cancelledVersionsRef.current.has(task.versionId)) ||
                    isNotFound;

                setTasks(prev => {
                    const idx = prev.findIndex(t => t.id === task.id);
                    if (idx === -1) return prev;
                    const updated = [...prev];
                    updated[idx] = {
                        ...updated[idx],
                        status: 'error',
                        error: isCancelled ? "Upload cancelled: Version deleted" : (err.response?.data?.detail || err.message)
                    };
                    return updated;
                });
            } finally {
                processingRef.current = false;
                // Cleanup ref after some time to prevent unbounded growth?
                // For now, we trust IDs won't be reused immediately. 
                // We can't delete immediately because loop might still be checking.
            }
        };

        const interval = setInterval(processQueue, 1000); // Check queue every second
        return () => clearInterval(interval);
    }, [tasks]);

    // Prevent accidental reload during uploads
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const hasActiveUploads = tasks.some(t => t.status === 'uploading' || t.status === 'pending');
            if (hasActiveUploads) {
                e.preventDefault();
                e.returnValue = ''; // Chrome requires returnValue to be set
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [tasks]);

    return (
        <BackgroundUploaderContext.Provider value={{ queueUpload, queueAlgorithmUpload, tasks, clearTask, cancelUploadsForVersion }}>
            {children}

            {/* GLOBAL UPLOAD INDICATOR */}
            {tasks.length > 0 && (
                <Stack
                    spacing={2}
                    sx={{
                        position: 'fixed',
                        bottom: 24,
                        left: 24,
                        zIndex: 2000,
                        width: 'auto',
                        maxWidth: 420
                    }}
                >
                    {tasks.filter(t => !t.dismissed).map(task => (
                        <Paper
                            key={task.id}
                            elevation={4}
                            sx={{
                                p: 2,
                                borderRadius: "16px",
                                border: `1px solid ${theme.border}`,
                                bgcolor: theme.paper,
                                backdropFilter: "blur(10px)",
                                boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    {task.status === 'uploading' && <CloudUploadIcon sx={{ color: theme.primary, animation: 'pulse 2s infinite' }} />}
                                    {task.status === 'completed' && <CheckCircleIcon sx={{ color: 'success.main' }} />}
                                    {task.status === 'error' && <ErrorIcon sx={{ color: 'error.main' }} />}
                                    {task.status === 'pending' && <CloudUploadIcon sx={{ color: theme.textMuted }} />}

                                    <Box>
                                        <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>
                                            {task.context === 'version' ? `Uploading ${task.type} files` : 'Uploading Artifacts'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: theme.textMuted }}>
                                            {task.context === 'version' ? `Version ${task.versionNumber}` : 'Algorithm Repository'} • {task.uploadedCount}/{task.totalCount} files
                                        </Typography>
                                    </Box>
                                </Stack>
                                <IconButton size="small" onClick={() => clearTask(task.id)} sx={{ color: theme.textMuted }}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>

                            {task.status === 'uploading' && (
                                <LinearProgress
                                    variant="determinate"
                                    value={task.progress}
                                    sx={{
                                        height: 6,
                                        borderRadius: 3,
                                        bgcolor: alpha(theme.primary, 0.1),
                                        '& .MuiLinearProgress-bar': {
                                            bgcolor: theme.primary,
                                            borderRadius: 3
                                        }
                                    }}
                                />
                            )}

                            {task.status === 'error' && (
                                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                                    {task.error}
                                </Typography>
                            )}
                        </Paper>
                    ))}
                </Stack>
            )}
        </BackgroundUploaderContext.Provider>
    );
};
