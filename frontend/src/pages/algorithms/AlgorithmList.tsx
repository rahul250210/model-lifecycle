"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Container,
  alpha,
  Paper,
  Stack,
  Chip,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SchemaIcon from "@mui/icons-material/Schema";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import CircularProgress from "@mui/material/CircularProgress";

import { useNavigate } from "react-router-dom";
import axios from "../../api/axios";

import { useTheme } from "../../theme/ThemeContext";
import { useTranslation } from "react-i18next";

export default function AlgorithmList() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [algorithms, setAlgorithms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [selectedAlgo, setSelectedAlgo] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIniConfig, setEditIniConfig] = useState("");
  const [editInputType, setEditInputType] = useState<"manual" | "file">("manual");
  const [saving, setSaving] = useState(false);

  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setEditIniConfig(text);
      }
    };
    reader.readAsText(file);
  };

  // Delete Dialog States
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleGenerateReport = async (algo: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await axios.get(
        `/algorithms/${algo.id}/report`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers['content-disposition'];
      let filename = `${algo.name.replace(/ /g, '_').toLowerCase()}_report.csv`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match.length === 2) {
          filename = match[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading report:", error);
      alert(t('algorithmList.reportDownloadFail', "Failed to generate algorithm report"));
    }
  };

  const fetchAlgorithms = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/algorithms");
      setAlgorithms(res.data);
    } catch (err) {
      console.error("Failed to load algorithms", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlgorithms();

    const handleEntityCreated = () => {
      fetchAlgorithms();
    };
    window.addEventListener("entityCreated", handleEntityCreated);
    return () => window.removeEventListener("entityCreated", handleEntityCreated);
  }, []);

  if (loading) {
    return (
      <Box sx={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.background }}>
        <CircularProgress size={40} sx={{ color: theme.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.background, pb: 10 }}>
      <Container maxWidth={false}>
        {/* Header Section */}
        <Box sx={{ pt: 6, pb: 6 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={3}>
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <IconButton
                  onClick={() => navigate(`/dashboard`)}
                  sx={{
                    bgcolor: theme.paper,
                    border: `1px solid ${theme.border}`,
                    "&:hover": { bgcolor: theme.primaryLight, color: theme.primary }
                  }}
                >
                  <ArrowBackIcon fontSize="small" sx={{ color: theme.textMain }} />
                </IconButton>

                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" sx={{ color: theme.textSecondary }} />} aria-label="breadcrumb">
                  <Link
                    underline="hover"
                    color="inherit"
                    onClick={() => navigate(`/dashboard`)}
                    sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1.2rem', color: theme.textSecondary }}
                  >
                    {t('algorithmList.dashboard', 'Dashboard')}
                  </Link>
                  <Typography fontWeight={700} sx={{ fontSize: '1.2rem', color: theme.textMain }}>{t('algorithmList.algorithms', 'Algorithms')}</Typography>
                </Breadcrumbs>
              </Stack>
              <Typography variant="h5" fontWeight={800} sx={{ color: theme.textMain, letterSpacing: "-0.02em", mb: 1 }}>
                {t('algorithmList.algorithm', 'Algorithm')} <Box component="span" sx={{ color: theme.primary }}>{t('algorithmList.library', 'Library')}</Box>
              </Typography>
              <Typography variant="h6" sx={{ color: theme.textMuted, fontWeight: 400, maxWidth: 600 }}>
                {t('algorithmList.subtitle', 'Manage high-level architectural blueprints and view their associated production models.')}
              </Typography>
            </Box >
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate("/algorithms/create")}
              sx={{
                bgcolor: theme.primary,
                px: 4,
                py: 1.5,
                borderRadius: "14px",
                fontWeight: 700,
                fontSize: "1rem",
                textTransform: "none",
                boxShadow: `0 10px 15px -3px ${alpha(theme.primary, 0.3)}`,
                "&:hover": { bgcolor: "#4338CA", transform: "translateY(-2px)" },
                transition: "all 0.2s",
              }}
            >
              {t('algorithmList.createAlgorithm', 'Create Algorithm')}
            </Button>
          </Stack >
        </Box >

        {/* Algorithm Grid */}
        < Grid container spacing={4} justifyContent="flex-start" >
          {
            algorithms.map((algo) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={algo.id}>
                    <Card
                      onClick={() => navigate(`/algorithms/${algo.id}/factories`)}
                      sx={{
                        borderRadius: "24px",
                        height: "100%",
                        bgcolor: theme.paper,
                        border: `1px solid ${theme.border}`,
                        transition: "all 0.3s",
                        cursor: "pointer",
                        "&:hover": {
                          borderColor: theme.primary,
                          boxShadow: `0 25px 30px -5px ${alpha("#000", 0.08)}`,
                          transform: "translateY(-4px)"
                        },
                      }}
                      elevation={0}
                    >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
                      <Box sx={{ p: 1, bgcolor: alpha(theme.primary, 0.08), borderRadius: "10px" }}>
                        <SchemaIcon sx={{ color: theme.primary, fontSize: 20 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" onClick={(e) => handleGenerateReport(algo, e)} title={t('algorithmList.downloadReport', 'Algorithm Report')}>
                          <DownloadIcon fontSize="small" sx={{ color: theme.success }} />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAlgo(algo);
                          setEditName(algo.name);
                          setEditDescription(algo.description || "");
                          setEditIniConfig(algo.ini_config || "");
                          setEditInputType("manual");
                          setEditOpen(true);
                        }}>
                          <EditIcon fontSize="small" sx={{ color: theme.textMuted }} />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAlgo(algo);
                          setDeleteOpen(true);
                        }} sx={{ color: alpha(theme.danger, 0.7) }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <Typography variant="h5" fontWeight={600} sx={{ color: theme.textMain, mb: 1 }}>
                      {algo.name}
                    </Typography>

                    <Typography variant="body2" sx={{ color: theme.textMuted, mb: 3, minHeight: 40, lineHeight: 1.6 }}>
                      {algo.description || t('algorithmList.noDescription', 'No description provided for this algorithm.')}
                    </Typography>

                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 3, borderTop: `1px solid ${theme.border}`, flexWrap: "wrap", gap: 1 }}>
                      <Stack direction="row" spacing={2}>
                        <Chip
                          label={t('algorithmList.activeModels', '{{count}} Active Models', { count: algo.models_count })}
                          sx={{
                            bgcolor: theme.primaryLight,
                            color: theme.primary,
                            fontWeight: 700,
                            borderRadius: "10px",
                            px: 1,
                            py: 2
                          }}
                        />
                      </Stack>

                      <Box
                        className="arrow-icon"
                        sx={{
                          opacity: 1,
                          transform: "translateX(0)",
                          transition: "all 0.3s",
                          color: theme.primary,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: alpha(theme.primary, 0.05) }
                        }}
                      >
                        <Typography variant="button" fontWeight={700}>{t('algorithmList.viewFactories', 'View Factories')}</Typography>
                        <ArrowForwardIcon />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))
          }
        </Grid >

        {/* Empty State */}
        {
          algorithms.length === 0 && (
            <Paper variant="outlined" sx={{ py: 15, textAlign: 'center', borderRadius: '32px', borderStyle: 'dashed', bgcolor: 'transparent' }}>
              <SchemaIcon sx={{ fontSize: 64, color: alpha(theme.textMuted, 0.2), mb: 3 }} />
              <Typography variant="h5" fontWeight={700} color={theme.textMain}>{t('algorithmList.noAlgorithmsTitle', 'No algorithms found')}</Typography>
              <Typography variant="body1" color={theme.textMuted}>{t('algorithmList.noAlgorithmsDesc', 'Blueprints database is empty. Get started by creating your first global algorithm architecture.')}</Typography>
            </Paper>
          )
        }
      </Container >

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        PaperProps={{ sx: { borderRadius: "24px", p: 1, maxWidth: 500, width: '100%', bgcolor: theme.background } }}
      >
        <DialogTitle sx={{ fontWeight: 900, color: theme.textMain, letterSpacing: "-0.02em", pt: 3 }}>
          {t('algorithmList.updateArchitecture', 'Update Architecture')}
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, mb: 1, display: 'block', textTransform: 'uppercase' }}>{t('algorithmList.algorithmName', 'Algorithm Name')}</Typography>
              <TextField
                fullWidth
                variant="outlined"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px", bgcolor: theme.paper, color: theme.textMain } }}
              />
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, mb: 1, display: 'block', textTransform: 'uppercase' }}>{t('algorithmList.description', 'Description')}</Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px", bgcolor: theme.paper, color: theme.textMain } }}
              />
            </Box>
            
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, textTransform: 'uppercase' }}>
                  {t("algorithmCreate.iniConfigLabel", "INI Configuration")}
                </Typography>
                <ToggleButtonGroup
                  value={editInputType}
                  exclusive
                  onChange={(_, newVal) => { if(newVal) setEditInputType(newVal) }}
                  size="small"
                  sx={{ 
                    height: 28,
                    '& .MuiToggleButton-root': {
                      color: theme.textSecondary,
                      borderColor: alpha(theme.border, 0.5),
                      '&.Mui-selected': { color: theme.primary, bgcolor: alpha(theme.primary, 0.1) },
                      '&:hover': { bgcolor: alpha(theme.textMain, 0.05) }
                    }
                  }}
                >
                  <ToggleButton value="manual" sx={{ px: 2, textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                    {t("algorithmCreate.manualEntry", "Manual Entry")}
                  </ToggleButton>
                  <ToggleButton value="file" sx={{ px: 2, textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                    <FileUploadIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    {t("algorithmCreate.uploadIniFile", "Upload .ini file")}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {editInputType === "file" ? (
                <Box sx={{ border: `1px dashed ${theme.border}`, borderRadius: "12px", p: 3, textAlign: 'center', bgcolor: alpha(theme.primary, 0.02) }}>
                  <Button variant="outlined" component="label" sx={{ borderRadius: "8px", textTransform: 'none', fontWeight: 600 }}>
                    {t("algorithmCreate.uploadIniFile", "Upload .ini file")}
                    <input type="file" accept=".ini,.txt" hidden onChange={handleEditFileUpload} />
                  </Button>
                  {editIniConfig && (
                    <Box sx={{ mt: 3, textAlign: 'left' }}>
                       <Typography variant="caption" sx={{ display: 'block', mb: 1, color: theme.success || "#4caf50", fontWeight: 700 }}>
                         ✓ INI file loaded successfully
                       </Typography>
                       <Box sx={{ p: 2, borderRadius: '8px', bgcolor: theme.background, border: `1px solid ${theme.border}`, maxHeight: '150px', overflowY: 'auto' }}>
                         <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: theme.textMain }}>
                           {editIniConfig}
                         </Typography>
                       </Box>
                    </Box>
                  )}
                </Box>
              ) : (
                <TextField
                  placeholder={t("algorithmCreate.iniConfigPlaceholder", "[AlgorithmName]\nParam1=100")}
                  fullWidth
                  multiline
                  rows={5}
                  value={editIniConfig}
                  onChange={(e) => setEditIniConfig(e.target.value)}
                  variant="outlined"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px", bgcolor: theme.paper, fontFamily: 'monospace', fontSize: '0.875rem', color: theme.textMain
                    }
                  }}
                />
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: theme.textMuted, fontWeight: 700, px: 3, textTransform: 'none' }}>{t('algorithmList.cancel', 'Cancel')}</Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!selectedAlgo) return;
              try {
                setSaving(true);
                const res = await axios.put(`/algorithms/${selectedAlgo.id}`, {
                  name: editName,
                  description: editDescription,
                  ini_config: editIniConfig || null,
                });
                setAlgorithms((prev) => prev.map((a) => (a.id === selectedAlgo.id ? res.data : a)));
                setEditOpen(false);
              } catch (err) { console.error(err); } finally { setSaving(false); }
            }}
            variant="contained" sx={{ bgcolor: theme.primary, borderRadius: "12px", fontWeight: 700, px: 4, py: 1.2, textTransform: 'none', boxShadow: `0 8px 16px -4px ${alpha(theme.primary, 0.3)}` }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : t('algorithmList.saveChanges', 'Save Changes')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      < Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} PaperProps={{ sx: { borderRadius: "24px", bgcolor: theme.paper } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem', color: theme.textMain }}>{t('algorithmList.deleteTitle', 'Permanently Delete?')}</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: theme.textMuted, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: t('algorithmList.deleteWarning', 'You are about to delete <strong>{{name}}</strong>. This will delete all associated models and experiments across all factories. This action cannot be reversed.', { name: selectedAlgo?.name }) }} />
        </DialogContent>
        <DialogActions sx={{ p: 4 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ fontWeight: 700, color: theme.textMain, px: 3 }}>{t('algorithmList.keepIt', 'Keep it')}</Button>
          <Button
            variant="contained"
            color="error"
            sx={{ borderRadius: "12px", fontWeight: 700, px: 3, bgcolor: theme.danger }}
            onClick={async () => {
              if (!selectedAlgo) return;
              try {
                await axios.delete(`/algorithms/${selectedAlgo.id}`);
                setAlgorithms((prev) => prev.filter((a) => a.id !== selectedAlgo.id));
                setDeleteOpen(false);
              } catch (err) { console.error(err); }
            }}
          >
            {t('algorithmList.yesDelete', 'Yes, Delete Algorithm')}
          </Button>
        </DialogActions>
      </Dialog >
    </Box >
  );
}