import React, { useRef, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Stack,
    IconButton,
    alpha,
    Paper,
    Divider,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { useTheme } from "../theme/ThemeContext";

interface FileUploadDialogProps {
    open: boolean;
    onClose: () => void;
    onUpload: (files: File[]) => void;
    title: string;
    allowedExtensions?: string[];
    allowDirectory?: boolean;
}

export default function FileUploadDialog({
    open,
    onClose,
    onUpload,
    title,
    allowedExtensions,
    allowDirectory = true,
}: FileUploadDialogProps) {
    const { theme } = useTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    // Helper to recursively get files from dropped items/folders
    const getAllFilesFromEntry = async (entry: any, fileList: File[]): Promise<void> => {
        // FILTER: Ignore system files
        if (['Thumbs.db', '.DS_Store', 'desktop.ini'].includes(entry.name)) {
            return;
        }

        if (entry.isFile) {
            const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));

            // Store the full path on the file object manually so we can use it later
            const trimmedPath = entry.fullPath.startsWith('/') ? entry.fullPath.slice(1) : entry.fullPath;

            Object.defineProperty(file, 'webkitRelativePath', {
                value: trimmedPath,
                writable: false
            });

            fileList.push(file);
        } else if (entry.isDirectory) {
            const directoryReader = entry.createReader();

            const readEntriesPromise = async (): Promise<any[]> => {
                let allEntries: any[] = [];
                let finished = false;

                while (!finished) {
                    const batch = await new Promise<any[]>((resolve, reject) => {
                        directoryReader.readEntries(resolve, reject);
                    });

                    if (batch.length === 0) {
                        finished = true;
                    } else {
                        allEntries = allEntries.concat(batch);
                    }
                }
                return allEntries;
            };

            const entries = await readEntriesPromise();

            // Process sequentially to avoid memory spikes
            for (const childEntry of entries) {
                await getAllFilesFromEntry(childEntry, fileList);
            }
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const items = Array.from(e.dataTransfer.items);
        const files: File[] = [];

        for (const item of items) {
            const entry = (item as any).webkitGetAsEntry();
            if (entry) {
                await getAllFilesFromEntry(entry, files);
            } else {
                const file = item.getAsFile();
                if (file && !['Thumbs.db', '.DS_Store', 'desktop.ini'].includes(file.name)) {
                    files.push(file);
                }
            }
        }

        let filtered = files;
        if (allowedExtensions) {
            filtered = files.filter((f) =>
                allowedExtensions.some((ext) => f.name.toLowerCase().endsWith(ext))
            );
        }

        setStagedFiles((prev) => {
            // Optimization: Use Set for O(1) lookups to avoid O(N^2) freeze
            const existingKeys = new Set(prev.map(p => `${(p as any).webkitRelativePath || p.name}-${p.size}`));
            const uniqueNewFiles = filtered.filter(f => !existingKeys.has(`${(f as any).webkitRelativePath || f.name}-${f.size}`));
            return [...prev, ...uniqueNewFiles];
        });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            let files = Array.from(e.target.files);

            // FILTER: System files
            files = files.filter(f => !['Thumbs.db', '.DS_Store', 'desktop.ini'].includes(f.name));

            if (allowedExtensions) {
                files = files.filter((f) =>
                    allowedExtensions.some((ext) => f.name.toLowerCase().endsWith(ext))
                );
            }
            setStagedFiles((prev) => {
                const newFiles = files.filter(f => !prev.some(p => ((p as any).webkitRelativePath || p.name) === ((f as any).webkitRelativePath || f.name) && p.size === f.size));
                return [...prev, ...newFiles];
            });
        }
    };

    const handleRemoveFile = (index: number) => {
        setStagedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleConfirm = () => {
        onUpload(stagedFiles);
        setStagedFiles([]);
        onClose();
    };

    const handleCancel = () => {
        setStagedFiles([]);
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleCancel}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: "24px",
                    bgcolor: theme.paper,
                    border: `1px solid ${alpha(theme.border, 0.5)}`,
                    backgroundImage: "none",
                    boxShadow: `0 24px 48px -12px ${alpha(theme.textMain, 0.15)}`,
                },
            }}
        >
            <DialogTitle
                sx={{
                    p: 3,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>
                    {title}
                </Typography>
                <IconButton onClick={handleCancel} size="small" sx={{ color: theme.textMuted }}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ px: 3, pb: 2 }}>
                <Typography variant="body2" sx={{ color: theme.textMuted, mb: 3 }}>
                    Drag and drop folders/files here to avoid security popups, or use the buttons below.
                </Typography>

                <Paper
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    elevation={0}
                    sx={{
                        height: 180,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        mb: 3,
                        borderRadius: "24px",
                        border: `2px dashed ${isDragging ? theme.primary : alpha(theme.border, 0.4)}`,
                        bgcolor: isDragging ? alpha(theme.primary, 0.05) : alpha(theme.background, 0.4),
                        transition: "all 0.3s ease",
                        cursor: "pointer",
                        "&:hover": {
                            borderColor: theme.primary,
                            bgcolor: alpha(theme.primary, 0.02),
                        },
                    }}
                >
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: "50%",
                            bgcolor: alpha(theme.primary, 0.1),
                            color: theme.primary,
                        }}
                    >
                        <UploadFileIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Box sx={{ textAlign: "center" }}>
                        <Typography variant="body2" fontWeight={800} sx={{ color: theme.textMain }}>
                            Drag & Drop Folder or Files
                        </Typography>
                        <Typography variant="caption" sx={{ color: theme.textMuted }}>
                            Quickly stage multiple artifacts at once
                        </Typography>
                    </Box>
                </Paper>

                <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<UploadFileIcon />}
                        onClick={() => fileInputRef.current?.click()}
                        sx={{
                            borderRadius: "16px",
                            py: 1.5,
                            textTransform: "none",
                            fontWeight: 700,
                            border: `2px dashed ${theme.border}`,
                            "&:hover": { borderColor: theme.primary, bgcolor: alpha(theme.primary, 0.04) },
                        }}
                    >
                        Select Files
                    </Button>
                    {allowDirectory && (
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<FolderOpenIcon />}
                            onClick={() => folderInputRef.current?.click()}
                            sx={{
                                borderRadius: "16px",
                                py: 1.5,
                                textTransform: "none",
                                fontWeight: 700,
                                border: `2px dashed ${theme.border}`,
                                "&:hover": { borderColor: theme.primary, bgcolor: alpha(theme.primary, 0.04) },
                            }}
                        >
                            Select Folder
                        </Button>
                    )}
                </Stack>

                <input
                    type="file"
                    ref={fileInputRef}
                    hidden
                    multiple
                    onChange={handleFileChange}
                />
                <input
                    type="file"
                    ref={folderInputRef}
                    hidden
                    {...({ webkitdirectory: "", directory: "" } as any)}
                    onChange={handleFileChange}
                />

                {stagedFiles.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMuted, mb: 1, display: 'block' }}>
                            STAGED FOR UPLOAD ({stagedFiles.length})
                        </Typography>
                        <Paper
                            elevation={0}
                            sx={{
                                maxHeight: "300px",
                                overflowY: "auto",
                                bgcolor: alpha(theme.background, 0.5),
                                borderRadius: "16px",
                                border: `1px solid ${theme.border}`,
                                p: 1,
                                "&::-webkit-scrollbar": { width: "6px" },
                                "&::-webkit-scrollbar-thumb": {
                                    bgcolor: alpha(theme.textMain, 0.1),
                                    borderRadius: "10px",
                                },
                            }}
                        >
                            <Stack spacing={0.5}>
                                {stagedFiles.slice(0, 50).map((file, idx) => (
                                    <Box
                                        key={`${file.name}-${idx}`}
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            p: 1,
                                            borderRadius: "10px",
                                            bgcolor: theme.paper,
                                            border: `1px solid ${alpha(theme.border, 0.3)}`,
                                        }}
                                    >
                                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                                            <InsertDriveFileIcon fontSize="small" sx={{ color: theme.primary }} />
                                            <Typography
                                                variant="caption"
                                                fontWeight={600}
                                                sx={{
                                                    color: theme.textMain,
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                            >
                                                {file.name}
                                            </Typography>
                                        </Stack>
                                        <IconButton size="small" color="error" onClick={() => handleRemoveFile(idx)}>
                                            <CloseIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </Box>
                                ))}
                                {stagedFiles.length > 50 && (
                                    <Box sx={{ p: 1.5, textAlign: 'center', bgcolor: alpha(theme.background, 0.3), borderRadius: '8px' }}>
                                        <Typography variant="caption" sx={{ color: theme.textMuted, fontStyle: 'italic', fontWeight: 600 }}>
                                            ...and {stagedFiles.length - 50} more files
                                        </Typography>
                                    </Box>
                                )}
                            </Stack>
                        </Paper>
                    </Box>
                )}
            </DialogContent>

            <Divider sx={{ opacity: 0.5 }} />

            <DialogActions sx={{ p: 3 }}>
                <Button
                    onClick={handleCancel}
                    sx={{
                        fontWeight: 700,
                        color: theme.textMuted,
                        textTransform: "none",
                        borderRadius: "12px",
                    }}
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    disabled={stagedFiles.length === 0}
                    onClick={handleConfirm}
                    sx={{
                        bgcolor: theme.primary,
                        color: "#FFFFFF",
                        borderRadius: "12px",
                        fontWeight: 700,
                        px: 4,
                        textTransform: "none",
                        boxShadow: `0 8px 20px ${alpha(theme.primary, 0.3)}`,
                        "&:hover": { bgcolor: theme.primaryDark },
                        "&.Mui-disabled": {
                            bgcolor: alpha(theme.textMain, 0.1),
                            color: alpha(theme.textMain, 0.3),
                        }
                    }}
                >
                    Confirm Staging
                </Button>
            </DialogActions>
        </Dialog>
    );
}
