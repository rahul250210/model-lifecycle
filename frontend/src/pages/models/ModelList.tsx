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
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HistoryIcon from "@mui/icons-material/History";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import CircularProgress from "@mui/material/CircularProgress";

import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

import { useTheme } from "../../theme/ThemeContext";

export default function ModelList() {
  const { factoryId, algorithmId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

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

  // Delete Dialog States
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Using Promise.allReflected if one fails? No, normal Promise.all
        // Need to be careful about 404s if fetching all algorithms but simple error catching is fine for now
        const [modelsRes, factoryRes, allAlgosRes] = await Promise.all([
          axios.get(`/factories/${factoryId}/algorithms/${algorithmId}/models`),
          axios.get(`/factories/${factoryId}`),
          axios.get(`/factories/${factoryId}/algorithms`)
        ]);

        setModels(modelsRes.data);
        if (factoryRes.data && factoryRes.data.name) {
          setFactoryName(factoryRes.data.name);
        }

        const currentAlgo = (allAlgosRes.data as any[]).find((a: any) => a.id == algorithmId);
        if (currentAlgo) {
          setAlgorithmName(currentAlgo.name);
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
                  onClick={() => navigate(`/factories/${factoryId}/algorithms`)}
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
                    onClick={() => navigate("/factories")}
                    sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1.2rem', color: theme.textSecondary }}
                  >
                    Factories
                  </Link>
                  <Link
                    underline="hover"
                    color="inherit"
                    onClick={() => navigate(`/factories/${factoryId}/algorithms`)}
                    sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1.2rem', color: theme.textSecondary }}
                  >
                    {factoryName}
                  </Link>
                  <Typography fontWeight={700} sx={{ fontSize: '1.2rem', color: theme.textMain }}>{algorithmName}</Typography>
                </Breadcrumbs>
              </Stack>
              <Typography variant="h5" fontWeight={800} sx={{ color: theme.textMain, letterSpacing: "-0.02em", mb: 1 }}>
                Model <Box component="span" sx={{ color: theme.primary }}>Repository</Box>
              </Typography>
              <Typography variant="h6" sx={{ color: theme.textMuted, fontWeight: 400, maxWidth: 600 }}>
                Manage specific model implementations and track their version history.
              </Typography>
            </Box >
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/create`)}
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
              Add Model
            </Button>
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
                    "&:hover": {
                      borderColor: theme.primary,
                      boxShadow: `0 25px 30px -5px ${alpha("#000", 0.08)}`,
                      "& .arrow-icon": { opacity: 1, transform: "translateX(0)" }
                    },
                  }}
                  elevation={0}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                      <Box sx={{ p: 1, bgcolor: alpha(theme.primary, 0.08), borderRadius: "10px" }}>
                        <HubIcon sx={{ color: theme.primary, fontSize: 20 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
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
                      {model.description || "No description provided for this model instance."}
                    </Typography>

                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 3, borderTop: `1px solid ${theme.border}`, flexWrap: "wrap", gap: 1 }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Chip
                          icon={<HistoryIcon style={{ fontSize: 18 }} />}
                          label={`${model.versions_count} Versions`}
                          sx={{
                            bgcolor: theme.primaryLight,
                            color: theme.primary,
                            fontWeight: 700,
                            borderRadius: "10px",
                            "& .MuiChip-icon": { color: theme.primary }
                          }}
                        />
                        <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                          Created {new Date(model.created_at).toLocaleDateString()}
                        </Typography>
                      </Stack>

                      <Box
                        className="arrow-icon"
                        onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${model.id}`)}
                        sx={{
                          opacity: 0,
                          transform: "translateX(-10px)",
                          transition: "all 0.3s",
                          color: theme.primary,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          cursor: 'pointer',
                          p: 1,
                          borderRadius: '8px',
                          '&:hover': { bgcolor: alpha(theme.primary, 0.05) }
                        }}
                      >
                        <Typography variant="button" fontWeight={700}>Versions</Typography>
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
              <Typography variant="h5" fontWeight={700} color={theme.textMain}>No models registered</Typography>
              <Typography variant="body1" color={theme.textMuted}>Get started by adding your first model implementation to this algorithm.</Typography>
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
          Edit Model Details
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, mb: 1, display: 'block', textTransform: 'uppercase' }}>Model Name</Typography>
              <TextField
                fullWidth
                variant="outlined"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px", bgcolor: theme.paper, color: theme.textMain } }}
              />
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, mb: 1, display: 'block', textTransform: 'uppercase' }}>Description</Typography>
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
          <Button onClick={() => setEditOpen(false)} sx={{ color: theme.textMuted, fontWeight: 700, textTransform: 'none', px: 3 }}>Cancel</Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!selectedModel) return;
              try {
                setSaving(true);
                const res = await axios.put(`/factories/${factoryId}/algorithms/${algorithmId}/models/${selectedModel.id}`, {
                  name: editName,
                  description: editDescription,
                });
                setModels((prev) => prev.map((m) => (m.id === selectedModel.id ? res.data : m)));
                setEditOpen(false);
              } catch (err) { console.error(err); } finally { setSaving(false); }
            }}
            variant="contained" sx={{ bgcolor: theme.primary, borderRadius: "12px", fontWeight: 700, px: 4, py: 1.2, textTransform: 'none', boxShadow: `0 8px 16px -4px ${alpha(theme.primary, 0.3)}` }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      < Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} PaperProps={{ sx: { borderRadius: "24px", bgcolor: theme.paper } }}>
        <DialogTitle sx={{ fontWeight: 800, color: theme.textMain }}>Delete Model?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: theme.textMuted }}>
            Are you sure you want to delete <strong>{selectedModel?.name}</strong>? All associated versions and experiments will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 4 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ fontWeight: 700, color: theme.textMain }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            sx={{ borderRadius: "12px", fontWeight: 700, px: 3 }}
            onClick={async () => {
              if (!selectedModel) return;
              try {
                await axios.delete(`/factories/${factoryId}/algorithms/${algorithmId}/models/${selectedModel.id}`);
                setModels((prev) => prev.filter((m) => m.id !== selectedModel.id));
                setDeleteOpen(false);
              } catch (err) { console.error(err); }
            }}
          >
            Delete Model
          </Button>
        </DialogActions>
      </Dialog >
    </Box >
  );
}