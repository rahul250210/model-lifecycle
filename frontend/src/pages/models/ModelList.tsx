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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import HubIcon from "@mui/icons-material/Hub";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import FactoryIcon from "@mui/icons-material/Factory";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HistoryIcon from "@mui/icons-material/History";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import CircularProgress from "@mui/material/CircularProgress";

import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

import toast from "react-hot-toast";

import { useTheme } from "../../theme/ThemeContext";
import { useTranslation } from "react-i18next";

export default function ModelList() {
  const { factoryId, algorithmId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [factoryName, setFactoryName] = useState("Factory");
  const [algorithmName, setAlgorithmName] = useState("Algorithm");

  // Edit Dialog States
  const [editOpen, setEditOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [factoryReportLoading, setFactoryReportLoading] = useState(false);

  // Delete Dialog States
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleGenerateFactoryReport = async () => {
    setFactoryReportLoading(true);
    try {
      const response = await axios.get(
        `/factories/${factoryId}/report`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers['content-disposition'];
      let filename = `factory_${factoryName.replace(/ /g, '_').toLowerCase()}_report.csv`;
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
      toast.success(t('factoryList.reportSuccess', "Report downloaded successfully"));
    } catch (error) {
      console.error("Error downloading factory report:", error);
      toast.error(t('factoryList.reportFail', "Failed to generate report. Please try again."));
    } finally {
      setFactoryReportLoading(false);
    }
  };

  const handleGenerateReport = async (model: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await axios.get(
        `/algorithms/${algorithmId}/factories/${factoryId}/models/${model.id}/report`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers['content-disposition'];
      let filename = `model_${model.name.replace(/ /g, '_').toLowerCase()}_report.csv`;
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
      toast.success(t('modelList.modelReportSuccess', "Model report downloaded"));
    } catch (error) {
      console.error("Error downloading report:", error);
      toast.error(t('modelList.modelReportFail', "Failed to generate model report"));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [modelsRes, factoryRes, algoRes] = await Promise.all([
          axios.get(`/algorithms/${algorithmId}/factories/${factoryId}/models`),
          axios.get(`/factories/${factoryId}`),
          axios.get(`/algorithms/${algorithmId}`)
        ]);

        setModels(modelsRes.data);
        if (factoryRes.data && factoryRes.data.name) {
          setFactoryName(factoryRes.data.name);
        }
        if (algoRes.data && algoRes.data.name) {
          setAlgorithmName(algoRes.data.name);
        }

      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [factoryId, algorithmId]);

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
                  onClick={() => navigate(`/algorithms/${algorithmId}/factories`)}
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
                    onClick={() => navigate(`/algorithms`)}
                    sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1.2rem', color: theme.textSecondary }}
                  >
                    {t('modelList.algorithms', 'Algorithms')}
                  </Link>
                  <Link
                    underline="hover"
                    color="inherit"
                    onClick={() => navigate(`/algorithms/${algorithmId}/factories`)}
                    sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1.2rem', color: theme.textSecondary }}
                  >
                    {algorithmName}
                  </Link>
                  <Typography fontWeight={700} sx={{ fontSize: '1.2rem', color: theme.textMain }}>{factoryName}</Typography>
                </Breadcrumbs>
              </Stack>
              <Typography variant="h5" fontWeight={800} sx={{ color: theme.textMain, letterSpacing: "-0.02em", mb: 1 }}>
                {t('modelList.model', 'Model')} <Box component="span" sx={{ color: theme.primary }}>{t('modelList.repository', 'Repository')}</Box>
              </Typography>
              <Typography variant="h6" sx={{ color: theme.textMuted, fontWeight: 400, maxWidth: 600 }}>
                {t('modelList.subtitle', 'Manage specific model implementations and track their version history.')}
              </Typography>
            </Box >
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<FactoryIcon />}
                onClick={() => navigate(`/factories/${factoryId}`)}
                sx={{
                  borderRadius: "14px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  px: 3,
                  py: 1.5,
                  textTransform: 'none',
                  border: `1px solid ${theme.border}`,
                  color: theme.primary,
                  borderColor: alpha(theme.primary, 0.5),
                  bgcolor: alpha(theme.primary, 0.05),
                  "&:hover": { bgcolor: alpha(theme.primary, 0.1), borderColor: theme.primary },
                }}
              >
                {t('modelList.factoryOverview', 'Factory Overview')}
              </Button>
              <Button
                variant="outlined"
                startIcon={factoryReportLoading ? <CircularProgress size={14} sx={{ color: theme.success }} /> : <DownloadIcon />}
                onClick={handleGenerateFactoryReport}
                disabled={factoryReportLoading}
                sx={{
                  borderRadius: "14px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  px: 3,
                  py: 1.5,
                  textTransform: 'none',
                  border: `1px solid ${theme.border}`,
                  color: theme.success,
                  borderColor: alpha(theme.success, 0.5),
                  bgcolor: alpha(theme.success, 0.05),
                  "&:hover": { bgcolor: alpha(theme.success, 0.1), borderColor: theme.success },
                }}
              >
                {factoryReportLoading ? t('factoryOverview.generating', 'Generating…') : t('modelList.factoryReport', 'Factory Report')}
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate(`/algorithms/${algorithmId}/factories/${factoryId}/models/create`)}
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
                {t('modelList.addModel', 'Add Model')}
              </Button>
            </Stack>
          </Stack >
        </Box >

        {/* Model Cards */}
        < Grid container spacing={4} justifyContent="flex-start" >
          {
            models.map((model) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={model.id}>
                <Card
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
                      "& .arrow-icon": { opacity: 1, transform: "translateX(0)" }
                    },
                  }}
                  elevation={0}
                  onClick={() => navigate(`/algorithms/${algorithmId}/factories/${factoryId}/models/${model.id}`)}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                      <Box sx={{ p: 1, bgcolor: alpha(theme.primary, 0.08), borderRadius: "10px" }}>
                        <HubIcon sx={{ color: theme.primary, fontSize: 20 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" onClick={(e) => handleGenerateReport(model, e)} title={t('modelList.downloadModelReport', 'Download Model Report')}>
                          <DownloadIcon fontSize="small" sx={{ color: theme.success }} />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedModel(model);
                          setEditName(model.name);
                          setEditDescription(model.description || "");
                          setEditOpen(true);
                        }}>
                          <EditIcon fontSize="small" sx={{ color: theme.textMuted }} />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedModel(model);
                          setDeleteOpen(true);
                        }} sx={{ color: alpha(theme.danger, 0.7) }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <Typography variant="h5" fontWeight={600} sx={{ color: theme.textMain, mb: 1 }}>
                      {model.name}
                    </Typography>

                    <Typography variant="body2" sx={{ color: theme.textMuted, mb: 3, minHeight: 40, lineHeight: 1.6 }}>
                      {model.description || t('modelList.noDescription', 'No description provided for this model instance.')}
                    </Typography>

                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 3, borderTop: `1px solid ${theme.border}`, flexWrap: "wrap", gap: 1 }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Chip
                          icon={<HistoryIcon style={{ fontSize: 18 }} />}
                          label={t('modelList.versions', '{{count}} Versions', { count: model.versions_count })}
                          sx={{
                            bgcolor: theme.primaryLight,
                            color: theme.primary,
                            fontWeight: 700,
                            borderRadius: "10px",
                            "& .MuiChip-icon": { color: theme.primary }
                          }}
                        />
                        <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                          {t('modelList.created', 'Created {{date}}', { date: new Date(model.created_at).toLocaleDateString() })}
                        </Typography>
                      </Stack>

                      <Box
                        className="arrow-icon"
                        sx={{
                          opacity: 0,
                          transform: "translateX(-10px)",
                          transition: "all 0.3s",
                          color: theme.primary,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1,
                          borderRadius: '8px',
                          '&:hover': { bgcolor: alpha(theme.primary, 0.05) }
                        }}
                      >
                        <Typography variant="button" fontWeight={700}>{t('modelList.versionsLink', 'Versions')}</Typography>
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
          models.length === 0 && (
            <Paper variant="outlined" sx={{ py: 15, textAlign: 'center', borderRadius: '32px', borderStyle: 'dashed', bgcolor: 'transparent' }}>
              <HubIcon sx={{ fontSize: 64, color: alpha(theme.textMuted, 0.2), mb: 3 }} />
              <Typography variant="h5" fontWeight={700} color={theme.textMain}>{t('modelList.noModelsTitle', 'No models registered')}</Typography>
              <Typography variant="body1" color={theme.textMuted}>{t('modelList.noModelsDesc', 'Get started by adding your first model implementation to this algorithm.')}</Typography>
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
          {t('modelList.editModelDetails', 'Edit Model Details')}
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, mb: 1, display: 'block', textTransform: 'uppercase' }}>{t('modelList.modelName', 'Model Name')}</Typography>
              <TextField
                fullWidth
                variant="outlined"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px", bgcolor: theme.paper, color: theme.textMain } }}
              />
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, mb: 1, display: 'block', textTransform: 'uppercase' }}>{t('modelList.description', 'Description')}</Typography>
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
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: theme.textMuted, fontWeight: 700, textTransform: 'none', px: 3 }}>{t('modelList.cancel', 'Cancel')}</Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!selectedModel) return;
              try {
                setSaving(true);
                const res = await axios.put(`/algorithms/${algorithmId}/factories/${factoryId}/models/${selectedModel.id}`, {
                  name: editName,
                  description: editDescription,
                });
                setModels((prev) => prev.map((m) => (m.id === selectedModel.id ? res.data : m)));
                setEditOpen(false);
              } catch (err) { console.error(err); } finally { setSaving(false); }
            }}
            variant="contained" sx={{ bgcolor: theme.primary, borderRadius: "12px", fontWeight: 700, px: 4, py: 1.2, textTransform: 'none', boxShadow: `0 8px 16px -4px ${alpha(theme.primary, 0.3)}` }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : t('modelList.saveChanges', 'Save Changes')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      < Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} PaperProps={{ sx: { borderRadius: "24px", bgcolor: theme.paper } }}>
        <DialogTitle sx={{ fontWeight: 800, color: theme.textMain }}>{t('modelList.deleteTitle', 'Delete Model?')}</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: theme.textMuted }} dangerouslySetInnerHTML={{ __html: t('modelList.deleteWarning', 'Are you sure you want to delete <strong>{{name}}</strong>? All associated versions and experiments will be lost.', { name: selectedModel?.name }) }} />
        </DialogContent>
        <DialogActions sx={{ p: 4 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ fontWeight: 700, color: theme.textMain }}>{t('modelList.cancel', 'Cancel')}</Button>
          <Button
            variant="contained"
            color="error"
            sx={{ borderRadius: "12px", fontWeight: 700, px: 3 }}
            onClick={async () => {
              if (!selectedModel) return;
              try {
                await axios.delete(`/algorithms/${algorithmId}/factories/${factoryId}/models/${selectedModel.id}`);
                setModels((prev) => prev.filter((m) => m.id !== selectedModel.id));
                setDeleteOpen(false);
              } catch (err) { console.error(err); }
            }}
          >
            {t('modelList.deleteModel', 'Delete Model')}
          </Button>
        </DialogActions>
      </Dialog >
    </Box >
  );
}