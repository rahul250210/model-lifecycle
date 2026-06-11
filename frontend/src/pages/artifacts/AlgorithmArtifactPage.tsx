"use client";

import { useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, Button, IconButton,
  Container, Stack, Paper, alpha, Chip, CardMedia,
  Breadcrumbs, Link as MuiLink, Dialog, DialogTitle, DialogContent,
  DialogActions, FormControlLabel, Checkbox, CircularProgress
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  PictureAsPdf,
  Slideshow,
  Description,
  Download,
  Delete,
  UploadFile,
  Category as CategoryIcon,
  NavigateNext as NavigateNextIcon,
  Code as CodeIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  AccountTree,
  ViewInAr,
  Visibility,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import axios, { API_BASE_URL } from "../../api/axios";

import { useTheme } from "../../theme/ThemeContext";
import FileUploadDialog from "../../components/FileUploadDialog";
import { useBackgroundUploader } from "../../contexts/BackgroundUploaderContext";
import ImageModal from "../../components/ImageModal";
import { useTranslation } from "react-i18next";

const getFileCategory = (name: string) => {
  const ext = name.toLowerCase().split('.').pop();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext!)) return "images";
  if (['ppt', 'pptx'].includes(ext!)) return "presentations";
  if (['pdf'].includes(ext!)) return "documents";
  if (['py', 'js', 'ts', 'tsx', 'jsx', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rb', 'php', 'sh', 'bat', 'ps1', 'json', 'xml', 'yaml', 'yml', 'md', 'sql'].includes(ext!)) return "code";
  return "other";
};

const getCategoryLabel = (categoryKey: string, t: any) => {
  switch (categoryKey) {
    case "images": return t("algorithmArtifact.photosAndImages", "Photos & Images");
    case "presentations": return t("algorithmArtifact.presentations", "Presentations (PPT)");
    case "documents": return t("algorithmArtifact.pdfDocuments", "PDF Documents");
    case "code": return t("algorithmArtifact.codeAndScripts", "Code & Scripts");
    default: return t("algorithmArtifact.otherResources", "Other Resources");
  }
};

export default function AlgorithmArtifactPage() {
  const { algorithmId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [files, setFiles] = useState<any[]>([]);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [zoomProps, setZoomProps] = useState<{ images: string[], initialIndex: number } | null>(null);

  const fetchFiles = async () => {
    try {
      const res = await axios.get(`/kb/algorithms/${algorithmId}/files`);
      setFiles(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchFiles(); }, [algorithmId]);

  /* ==========================================================================
     MULTIPLE UPLOAD HANDLER
  ========================================================================== */
  /* ==========================================================================
     MULTIPLE UPLOAD HANDLER
  ========================================================================== */
  const { queueAlgorithmUpload } = useBackgroundUploader();

  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadSelection, setDownloadSelection] = useState({
    images: false,
    presentations: false,
    documents: false,
    code: false,
    other: false,
  });

  const handleDownload = () => {
    setDownloadLoading(true);
    const params = new URLSearchParams();
    Object.entries(downloadSelection).forEach(([key, selected]) => {
      if (selected) params.append("categories", key);
    });

    const url = `${API_BASE_URL}/kb/algorithms/${algorithmId}/download_bundle?${params.toString()}`;

    setTimeout(() => {
      window.location.href = url;
      setTimeout(() => {
        setDownloadLoading(false);
        setDownloadDialogOpen(false);
      }, 3000);
    }, 500);
  };


  // Helper to check if a category has files
  const hasFiles = (backendKey: string) => {
    return (groupedFiles[backendKey] || []).length > 0;
  };

  const handleUpload = (uploadedFiles: File[]) => {
    if (uploadedFiles.length === 0) return;
    if (!algorithmId) return;

    queueAlgorithmUpload(parseInt(algorithmId), uploadedFiles);
    // Note: The list won't auto-refresh until upload completes. 
    // Usually background uploads imply user doesn't wait. 
    // We could add polling or listen to context, but simply letting them know it's queued is standard.
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("algorithmArtifact.deleteConfirm", "Delete artifact?"))) return;
    await axios.delete(`/kb/files/${id}`);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const groupedFiles = files.reduce((acc: any, file) => {
    const cat = getFileCategory(file.name);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(file);
    return acc;
  }, {});

  const renderPreview = (file: any, onZoom?: () => void) => {
    const name = file.name.toLowerCase();
    const isImage = name.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    const isPdf = name.endsWith(".pdf");
    const isPpt = name.endsWith(".ppt") || name.endsWith(".pptx");
    const isModel = ['onnx', 'pb', 'h5', 'tflite', 'keras', 'pkl', 'pt', 'pth'].some(ext => name.endsWith('.' + ext));
    const isCode = !isModel && ['py', 'js', 'ts', 'tsx', 'jsx', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rb', 'php', 'sh', 'bat', 'ps1', 'json', 'xml', 'yaml', 'yml', 'md', 'sql'].some(ext => name.endsWith('.' + ext));

    if (isImage) {
      return (
        <Box sx={{ position: 'relative', cursor: 'pointer', "&:hover .zoom-overlay": { opacity: 1 } }} onClick={onZoom}>
          <CardMedia
            component="img"
            height="140"
            image={`${API_BASE_URL}${file.url}`}
            alt={file.name}
            sx={{ objectFit: "cover", display: 'block' }}
          />
          <Box className="zoom-overlay" sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: alpha(theme.primary, 0.2),
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'all 0.2s',
          }}>
            <Box sx={{
              p: 1,
              borderRadius: '50%',
              bgcolor: 'rgba(0,0,0,0.6)',
              color: '#fff',
              display: 'flex'
            }}>
              <Visibility fontSize="small" />
            </Box>
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={{
        height: 140, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        bgcolor: isPdf ? alpha(theme.error, 0.08) : isPpt ? alpha(theme.warning, 0.08) : isCode ? alpha(theme.info, 0.08) : isModel ? alpha(theme.success, 0.08) : alpha(theme.primary, 0.08),
        borderBottom: `1px solid ${alpha(theme.border, 0.4)}`
      }}>
        {isPdf && <PictureAsPdf sx={{ fontSize: 44, color: theme.error }} />}
        {isPpt && <Slideshow sx={{ fontSize: 44, color: theme.warning }} />}
        {isCode && <CodeIcon sx={{ fontSize: 44, color: theme.info }} />}
        {isModel && <AccountTree sx={{ fontSize: 44, color: theme.success }} />}
        {!isPdf && !isPpt && !isCode && !isModel && <Description sx={{ fontSize: 44, color: theme.primary }} />}
        <Typography variant="overline" mt={1} fontWeight={900} sx={{ color: theme.textSecondary, letterSpacing: 1 }}>
          {name.split('.').pop()?.toUpperCase()}
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.background, pb: 10 }}>
      {/* HEADER: Glassmorphism effect consistent with other premium pages */}
      <Box sx={{
        flexShrink: 0,
        bgcolor: alpha(theme.background, 0.8),
        backdropFilter: "blur(24px)",
        borderBottom: `1px solid ${alpha(theme.border, 0.6)}`,
        zIndex: 10,
        position: 'sticky',
        top: 0,
        mb: 6
      }}>
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Breadcrumbs
                separator={<NavigateNextIcon fontSize="small" sx={{ color: theme.textMuted }} />}
                sx={{ mb: 1.5 }}
              >
                <MuiLink
                  underline="none"
                  onClick={() => navigate("/artifacts")}
                  sx={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    color: theme.textMuted,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    '&:hover': { color: theme.primary }
                  }}
                >
                  <ArrowBackIcon sx={{ mr: 0.5, fontSize: '1rem', color: theme.textMain }} /> {t("algorithmArtifact.artifacts", "Artifacts")}
                </MuiLink>
                <Typography sx={{ color: theme.textMain, fontSize: '0.875rem', fontWeight: 600 }}>
                  {t("algorithmArtifact.repositoryAssets", "Repository Assets")}
                </Typography>
              </Breadcrumbs>
 
              <Typography variant="h4" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: "-0.04em" }}>
                {t("algorithmArtifact.knowledgeRepository", "Knowledge Repository")}
              </Typography>
            </Box>

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                disableElevation
                disabled={false} // Background upload doesn't block
                onClick={() => setUploadDialogOpen(true)}
                startIcon={<UploadFile />}
                sx={{
                  bgcolor: theme.primary,
                  borderRadius: "14px",
                  px: 3.5,
                  py: 1.5,
                  fontWeight: 800,
                  textTransform: "none",
                  boxShadow: `0 8px 24px ${alpha(theme.primary, 0.25)}`,
                  "&:hover": {
                    bgcolor: theme.primaryDark,
                    boxShadow: `0 12px 32px ${alpha(theme.primary, 0.35)}`
                  },
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              >
                {t("algorithmArtifact.uploadAssets", "Upload Assets")}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  // Reset selection to safe defaults (all false)
                  setDownloadSelection({
                    images: false,
                    presentations: false,
                    documents: false,
                    code: false,
                    other: false,
                  });
                  setDownloadDialogOpen(true);
                }}
                startIcon={<Download />}
                sx={{
                  borderRadius: "14px",
                  px: 2.5,
                  py: 1.5,
                  fontWeight: 700,
                  textTransform: "none",
                  borderColor: theme.border,
                  color: theme.textMain,
                  "&:hover": { borderColor: theme.primary, color: theme.primary, bgcolor: alpha(theme.primary, 0.04) }
                }}
              >
                {t("algorithmArtifact.exportBundle", "Export Bundle")}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl">
        {Object.keys(groupedFiles).length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              py: 12,
              textAlign: 'center',
              borderRadius: '32px',
              border: `2px dashed ${alpha(theme.border, 0.6)}`,
              bgcolor: alpha(theme.paper, 0.4),
              backdropFilter: 'blur(8px)'
            }}
          >
            <Typography variant="h5" fontWeight={800} sx={{ color: theme.textMuted }}>
              {t("algorithmArtifact.emptyTitle", "This repository is currently empty.")}
            </Typography>
            <Typography sx={{ color: theme.textMuted, mt: 1, fontWeight: 500 }}>
              {t("algorithmArtifact.emptyDesc", "Use the upload button above to start adding assets.")}
            </Typography>
          </Paper>
        ) : (
          Object.keys(groupedFiles).map((category) => (
            <Box key={category} sx={{ mb: 10 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3.5 }}>
                <Box sx={{
                  p: 1.2,
                  borderRadius: "12px",
                  bgcolor: alpha(theme.primary, 0.1),
                  color: theme.primary,
                  display: 'flex'
                }}>
                  <CategoryIcon sx={{ fontSize: 24 }} />
                </Box>
                <Typography variant="h6" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: '-0.02em' }}>
                  {getCategoryLabel(category, t)}
                </Typography>
                <Chip
                  label={t("algorithmArtifact.itemsCount", { count: groupedFiles[category].length, defaultValue: `${groupedFiles[category].length} items` })}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    bgcolor: alpha(theme.textMain, 0.05),
                    color: theme.textSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`
                  }}
                />
              </Stack>

              {/* HORIZONTAL SCROLL CONTAINER */}
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'nowrap',
                  gap: 3,
                  overflowX: 'auto',
                  pb: 3,
                  px: 0.5,
                  '&::-webkit-scrollbar': { height: '8px' },
                  '&::-webkit-scrollbar-track': { bgcolor: alpha(theme.textMain, 0.02), borderRadius: '10px' },
                  '&::-webkit-scrollbar-thumb': {
                    bgcolor: alpha(theme.textMain, 0.08),
                    borderRadius: '10px',
                    '&:hover': { bgcolor: alpha(theme.textMain, 0.12) }
                  }
                }}
              >
                {groupedFiles[category]
                  .slice(0, visibleCounts[category] || 5)
                  .map((file: any) => (
                    <Card
                      key={file.id}
                      elevation={0}
                      sx={{
                        minWidth: 280,
                        maxWidth: 280,
                        borderRadius: "24px",
                        border: `1px solid ${theme.border}`,
                        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                        overflow: 'hidden',
                        bgcolor: theme.paper,
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0,
                        "&:hover": {
                          borderColor: theme.primary,
                          boxShadow: `0 24px 48px -12px ${alpha(theme.textMain, 0.12)}`
                        }
                      }}
                    >
                      <Box sx={{ position: 'relative' }}>
                        {renderPreview(file, () => {
                          const categoryFiles = groupedFiles[category];
                          const images = categoryFiles.map((f: any) => `${API_BASE_URL}${f.url}`);
                          const index = categoryFiles.findIndex((f: any) => f.id === file.id);
                          setZoomProps({ images, initialIndex: index });
                        })}
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(file.id)}
                          sx={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            bgcolor: alpha(theme.error, 0.1),
                            backdropFilter: 'blur(8px)',
                            color: theme.error,
                            '&:hover': { bgcolor: theme.error, color: 'white' }
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                      <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Typography
                          variant="body2"
                          fontWeight={800}
                          sx={{
                            color: theme.textMain,
                            mb: 2.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: '2.8em',
                            lineHeight: 1.4
                          }}
                        >
                          {file.name.split('/').pop()}
                        </Typography>

                        <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {['onnx', 'pb', 'h5', 'tflite', 'keras', 'pkl', 'pt', 'pth'].some(ext => file.name.toLowerCase().endsWith('.' + ext)) && !file.name.toLowerCase().endsWith('.engine') && !file.name.toLowerCase().endsWith('.plan') && (
                            <Button
                              fullWidth
                              variant="outlined"
                              disableElevation
                              startIcon={<ViewInAr />}
                              onClick={() => window.open(`${API_BASE_URL}/netron/index.html?url=${encodeURIComponent(`${API_BASE_URL}${file.url}`)}`, '_blank')}
                              sx={{
                                borderRadius: "12px",
                                textTransform: "none",
                                fontWeight: 800,
                                borderColor: alpha(theme.success, 0.5),
                                color: theme.success,
                                "&:hover": {
                                  bgcolor: alpha(theme.success, 0.08),
                                  borderColor: theme.success
                                },
                              }}
                            >
                              {t("algorithmArtifact.viewInNetron", "View in Netron")}
                            </Button>
                          )}
                          <Button
                            fullWidth
                            variant="contained"
                            disableElevation
                            disabled={downloadingId === file.id}
                            startIcon={downloadingId === file.id ? <CircularProgress size={20} color="inherit" /> : <Download />}
                            onClick={() => {
                              setDownloadingId(file.id);
                              // Artificial delay to show "Starting..." feedback before browser takes over
                              setTimeout(() => {
                                window.location.href = `${API_BASE_URL}${file.url}`;
                                // Reset after a few seconds assuming download started
                                setTimeout(() => setDownloadingId(null), 2500);
                              }, 500);
                            }}
                            sx={{
                              borderRadius: "12px",
                              textTransform: "none",
                              fontWeight: 800,
                              bgcolor: alpha(theme.primary, 0.06),
                              color: theme.primary,
                              "&:hover": { bgcolor: theme.primary, color: 'white' },
                              transition: 'all 0.2s ease',
                              "&.Mui-disabled": {
                                bgcolor: alpha(theme.primary, 0.1),
                                color: alpha(theme.primary, 0.6)
                              }
                            }}
                          >
                            {downloadingId === file.id ? t("algorithmArtifact.downloadStarting", "Starting...") : t("algorithmArtifact.downloadResource", "Download Resource")}
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}

                {/* PAGINATION CONTROLS */}
                {groupedFiles[category].length > 5 && (
                  <Card
                    elevation={0}
                    sx={{
                      minWidth: 200,
                      maxWidth: 200,
                      borderRadius: "24px",
                      border: `1px solid ${theme.border}`,
                      bgcolor: alpha(theme.paper, 0.6),
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: 2.5,
                      flexShrink: 0,
                      transition: "all 0.2s",
                      "&:hover": {
                        bgcolor: theme.paper,
                        boxShadow: `0 12px 32px -8px ${alpha(theme.textMain, 0.08)}`,
                        borderColor: alpha(theme.primary, 0.3)
                      }
                    }}
                  >
                    <Box sx={{
                      mb: 2,
                      p: 1.5,
                      borderRadius: "50%",
                      bgcolor: alpha(theme.primary, 0.08),
                      color: theme.primary
                    }}>
                      <CategoryIcon fontSize="small" />
                    </Box>

                    <Typography variant="caption" fontWeight={700} sx={{ color: theme.textSecondary, mb: 0.5 }}>
                      {t("algorithmArtifact.viewing", "Viewing")}
                    </Typography>
                    <Typography variant="h6" fontWeight={900} sx={{ color: theme.textMain, mb: 2 }}>
                      {Math.min(visibleCounts[category] || 5, groupedFiles[category].length)} <Box component="span" sx={{ color: theme.textMuted, fontSize: '0.75em' }}>/ {groupedFiles[category].length}</Box>
                    </Typography>

                    <Stack spacing={1.5} width="100%">
                      <Button
                        fullWidth
                        disabled={groupedFiles[category].length <= (visibleCounts[category] || 5)}
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => setVisibleCounts(prev => ({
                          ...prev,
                          [category]: (prev[category] || 5) + 5
                        }))}
                        sx={{
                          borderRadius: "10px",
                          textTransform: 'none',
                          fontWeight: 700,
                          boxShadow: 'none',
                          bgcolor: theme.primary,
                          '&:hover': { bgcolor: theme.primaryDark, boxShadow: 'none' },
                          '&.Mui-disabled': { bgcolor: alpha(theme.textMain, 0.05), color: theme.textMuted }
                        }}
                      >
                        {t("algorithmArtifact.showMore", "Show More")}
                      </Button>

                      <Button
                        fullWidth
                        disabled={(visibleCounts[category] || 5) <= 5}
                        variant="outlined"
                        size="small"
                        startIcon={<RemoveIcon />}
                        onClick={() => setVisibleCounts(prev => ({
                          ...prev,
                          [category]: Math.max(5, (prev[category] || 5) - 5)
                        }))}
                        sx={{
                          borderRadius: "10px",
                          textTransform: 'none',
                          fontWeight: 700,
                          borderWidth: "2px",
                          borderColor: alpha(theme.textMain, 0.1),
                          color: theme.textSecondary,
                          '&:hover': {
                            borderColor: theme.textMain,
                            bgcolor: alpha(theme.textMain, 0.02),
                            color: theme.textMain
                          },
                          '&.Mui-disabled': { borderWidth: "1px", borderColor: alpha(theme.textMain, 0.05) }
                        }}
                      >
                        {t("algorithmArtifact.showLess", "Show Less")}
                      </Button>
                    </Stack>
                  </Card>
                )}
              </Box>
            </Box>
          ))
        )}
      </Container>


      {/* DOWNLOAD DIALOG */}
      <Dialog open={downloadDialogOpen} onClose={() => setDownloadDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: '24px', p: 1, bgcolor: theme.background } }}
      >
        <DialogTitle sx={{ fontWeight: 700, letterSpacing: "-0.02em", color: theme.textMain }}>
          {t("algorithmArtifact.downloadBundleTitle", "Download Artifact Bundle")}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: theme.textMuted, mb: 3 }}>
            {t("algorithmArtifact.downloadBundleDesc", "Select the categories to include in the ZIP archive.")}
          </Typography>
          <Stack spacing={1}>
            {[
              { key: "images", label: t("algorithmArtifact.photosAndImages", "Photos & Images") },
              { key: "presentations", label: t("algorithmArtifact.presentations", "Presentations (PPT)") },
              { key: "documents", label: t("algorithmArtifact.pdfDocuments", "PDF Documents") },
              { key: "code", label: t("algorithmArtifact.codeAndScripts", "Code & Scripts") },
              { key: "other", label: t("algorithmArtifact.otherResources", "Other Resources") }
            ].map(({ key, label }) => {
              const isDisabled = !hasFiles(key);
              return (
                <FormControlLabel
                  key={key}
                  control={
                    <Checkbox
                      checked={!isDisabled && (downloadSelection as any)[key]}
                      onChange={(e: any) => setDownloadSelection({ ...downloadSelection, [key]: e.target.checked })}
                      disabled={isDisabled}
                      sx={{ color: theme.textMuted, '&.Mui-checked': { color: theme.primary } }}
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={700} sx={{ color: isDisabled ? theme.textMuted : theme.textMain, opacity: isDisabled ? 0.5 : 1 }}>
                      {label} {isDisabled && `(${t("algorithmArtifact.notAvailable", "Not Available")})`}
                    </Typography>
                  }
                />
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDownloadDialogOpen(false)} sx={{ fontWeight: 700, color: theme.textMuted, textTransform: 'none' }}>
            {t("algorithmArtifact.cancel", "Cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleDownload}
            disabled={downloadLoading || !Object.values(downloadSelection).some(Boolean)}
            sx={{
              bgcolor: theme.primary,
              borderRadius: '12px',
              fontWeight: 700,
              px: 3,
              textTransform: 'none',
              "&.Mui-disabled": {
                bgcolor: alpha(theme.primary, 0.7),
                color: alpha("#fff", 0.8)
              }
            }}
          >
            {downloadLoading ? <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} /> : null}
            {downloadLoading ? t("algorithmArtifact.preparing", "Preparing...") : t("algorithmArtifact.downloadZip", "Download ZIP")}
          </Button>
        </DialogActions>
      </Dialog >
 
      <FileUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUpload={handleUpload}
        title={t("algorithmArtifact.uploadDialogTitle", "Stage Algorithm Assets")}
        allowDirectory={true}
      />

      <ImageModal
        open={!!zoomProps}
        onClose={() => setZoomProps(null)}
        images={zoomProps?.images}
        initialIndex={zoomProps?.initialIndex}
      />
    </Box>
  );
}