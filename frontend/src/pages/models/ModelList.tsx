"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  alpha,
  Container,
  Paper,
  Stack,
  Tooltip,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import HubIcon from "@mui/icons-material/Hub";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import HistoryIcon from "@mui/icons-material/History";

import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

/* ==========================================================================
   CONSISTENT THEME PALETTE
   ========================================================================== */
const themePalette = {
  primary: "#4F46E5",
  primaryLight: "#EEF2FF",
  textMain: "#1E293B",
  textMuted: "#64748B",
  background: "#F8FAFC",
  border: "#E2E8F0",
  white: "#FFFFFF",
  danger: "#EF4444",
  success: "#10B981",
};

/* =======================
   Types
======================= */
interface Model {
  id: number;
  name: string;
  description?: string;
  versions_count: number;
  created_at: string;
}

export default function ModelList() {
  const { factoryId, algorithmId } = useParams();
  const navigate = useNavigate();

  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await axios.get(
          `/factories/${factoryId}/algorithms/${algorithmId}/models`
        );
        setModels(res.data);
      } catch (err) {
        console.error("Failed to load models", err);
      } finally {
        setLoading(false);
      }
    };
    fetchModels();
  }, [factoryId, algorithmId]);

  if (loading) {
    return (
      <Box sx={{ height: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={40} sx={{ color: themePalette.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: themePalette.background, pb: 8 }}>
      <Container maxWidth="xl">
        {/* Header Section */}
        <Box sx={{ pt: 4, pb: 6 }}>
          <Grid container justifyContent="space-between" alignItems="flex-end" spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <IconButton 
                  onClick={() => navigate(`/factories/${factoryId}/algorithms`)}
                  sx={{ 
                    bgcolor: themePalette.white, 
                    border: `1px solid ${themePalette.border}`,
                    "&:hover": { bgcolor: themePalette.primaryLight, color: themePalette.primary }
                  }}
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Typography variant="caption" fontWeight={700} sx={{ color: themePalette.primary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Algorithm Branch
                </Typography>
              </Stack>
              <Typography variant="h3" fontWeight={800} sx={{ color: themePalette.textMain, letterSpacing: "-0.02em", mb: 1 }}>
                Model <Box component="span" sx={{ color: themePalette.primary }}>Repository</Box>
              </Typography>
              <Typography variant="h6" sx={{ color: themePalette.textMuted, fontWeight: 400, maxWidth: 600 }}>
                Manage specific model implementations and track their version history.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: { md: 'right' } }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/create`)}
                sx={{
                  bgcolor: themePalette.primary,
                  px: 4,
                  py: 1.5,
                  borderRadius: "14px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  textTransform: "none",
                  boxShadow: `0 10px 15px -3px ${alpha(themePalette.primary, 0.3)}`,
                  "&:hover": { bgcolor: "#4338CA", transform: "translateY(-2px)" },
                  transition: "all 0.2s"
                }}
              >
                Add Model
              </Button>
            </Grid>
          </Grid>
        </Box>

        {/* Model Cards */}
          <Grid container spacing={4} justifyContent="flex-start">
          {models.map((model) => (
            <Grid size={{ xs: 12, md: 6 }} key={model.id}>
              <motion.div whileHover={{ y: -8 }} transition={{ type: "spring", stiffness: 300 }}>
                <Card
                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${model.id}`)}
                  sx={{
                    borderRadius: "24px",
                    cursor: "pointer",
                    height: "100%",
                    minWidth: 420,
                    bgcolor: themePalette.white,
                    border: `1px solid ${themePalette.border}`,
                    transition: "all 0.3s",
                    "&:hover": {
                      borderColor: themePalette.primary,
                      boxShadow: `0 25px 30px -5px ${alpha("#000", 0.08)}`,
                      "& .arrow-icon": { opacity: 1, transform: "translateX(0)" }
                    },
                  }}
                  elevation={0}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
                      <Box sx={{ p: 2, bgcolor: alpha(themePalette.primary, 0.08), borderRadius: "16px" }}>
                        <HubIcon sx={{ color: themePalette.primary, fontSize: 32 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Edit Model">
                          <IconButton size="medium" onClick={(e) => {
                            e.stopPropagation();
                            setSelectedModel(model);
                            setEditName(model.name);
                            setEditDescription(model.description || "");
                            setEditOpen(true);
                          }} sx={{ color: themePalette.textMuted, bgcolor: themePalette.background }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Model">
                          <IconButton size="medium" onClick={(e) => {
                            e.stopPropagation();
                            setSelectedModel(model);
                            setDeleteOpen(true);
                          }} sx={{ color: alpha(themePalette.danger, 0.6), bgcolor: themePalette.background }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Typography variant="h4" fontWeight={800} sx={{ color: themePalette.textMain, mb: 1.5 }}>
                      {model.name}
                    </Typography>
                    
                    <Typography variant="body1" sx={{ color: themePalette.textMuted, mb: 4, minHeight: 50, lineHeight: 1.7 }}>
                      {model.description || "No description provided for this model instance."}
                    </Typography>

                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 3, borderTop: `1px solid ${themePalette.border}` }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Chip 
                          icon={<HistoryIcon style={{ fontSize: 18 }} />}
                          label={`${model.versions_count} Versions`} 
                          sx={{ 
                            bgcolor: themePalette.primaryLight, 
                            color: themePalette.primary, 
                            fontWeight: 700, 
                            borderRadius: "10px",
                            "& .MuiChip-icon": { color: themePalette.primary }
                          }} 
                        />
                         <Typography variant="caption" sx={{ color: themePalette.textMuted, fontWeight: 600 }}>
                          Created {new Date(model.created_at).toLocaleDateString()}
                        </Typography>
                      </Stack>
                      
                      <Box className="arrow-icon" sx={{ opacity: 0, transform: "translateX(-10px)", transition: "all 0.3s", color: themePalette.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="button" fontWeight={700}>Versions</Typography>
                        <ArrowForwardIcon />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* Empty State */}
        {models.length === 0 && (
          <Paper variant="outlined" sx={{ py: 15, textAlign: 'center', borderRadius: '32px', borderStyle: 'dashed', bgcolor: 'transparent' }}>
            <HubIcon sx={{ fontSize: 64, color: alpha(themePalette.textMuted, 0.2), mb: 3 }} />
            <Typography variant="h5" fontWeight={700} color={themePalette.textMain}>No models registered</Typography>
            <Typography variant="body1" color={themePalette.textMuted}>Get started by adding your first model implementation to this algorithm.</Typography>
          </Paper>
        )}
      </Container>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} PaperProps={{ sx: { borderRadius: "24px", p: 1 } }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: themePalette.textMain }}>Edit Model Details</DialogTitle>
        <DialogContent>
          <TextField 
            fullWidth label="Model Name" value={editName} onChange={(e) => setEditName(e.target.value)} 
            margin="normal" variant="outlined" sx={{ "& .MuiOutlinedInput-root": { borderRadius: "14px" } }} 
          />
          <TextField 
            fullWidth label="Description" multiline rows={4} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} 
            margin="normal" variant="outlined" sx={{ "& .MuiOutlinedInput-root": { borderRadius: "14px" } }} 
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: themePalette.textMuted, fontWeight: 700 }}>Cancel</Button>
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
            variant="contained" sx={{ bgcolor: themePalette.primary, borderRadius: "12px", fontWeight: 700, px: 3 }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} PaperProps={{ sx: { borderRadius: "24px" } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete Model?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: themePalette.textMuted }}>
            Are you sure you want to delete <strong>{selectedModel?.name}</strong>? All associated versions and experiments will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 4 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ fontWeight: 700, color: themePalette.textMain }}>Cancel</Button>
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
      </Dialog>
    </Box>
  );
}