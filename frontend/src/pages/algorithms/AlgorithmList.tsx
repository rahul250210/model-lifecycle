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
import SchemaIcon from "@mui/icons-material/Schema";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import CircularProgress from "@mui/material/CircularProgress";

import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

import { useTheme } from "../../theme/ThemeContext";

export default function AlgorithmList() {
  const { factoryId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [algorithms, setAlgorithms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [factoryName, setFactoryName] = useState("Factory");

  // Edit Dialog States
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAlgo, setSelectedAlgo] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete Dialog States
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [algoRes, factoryRes] = await Promise.all([
          axios.get(`/factories/${factoryId}/algorithms`),
          axios.get(`/factories/${factoryId}`)
        ]);
        setAlgorithms(algoRes.data);
        if (factoryRes.data && factoryRes.data.name) {
          setFactoryName(factoryRes.data.name);
        }
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [factoryId]);

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
                  onClick={() => navigate(`/factories`)}
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
                    onClick={() => navigate("/factories")}
                    sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1.2rem', color: theme.textSecondary }}
                  >
                    Factories
                  </Link>
                  <Typography fontWeight={700} sx={{ fontSize: '1.2rem', color: theme.textMain }}>{factoryName}</Typography>
                </Breadcrumbs>
              </Stack>
              <Typography variant="h5" fontWeight={800} sx={{ color: theme.textMain, letterSpacing: "-0.02em", mb: 1 }}>
                Algorithm <Box component="span" sx={{ color: theme.primary }}>Library</Box>
              </Typography>
              <Typography variant="h6" sx={{ color: theme.textMuted, fontWeight: 400, maxWidth: 600 }}>
                Manage high-level architectural blueprints and view their associated production models.
              </Typography>
            </Box >
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate(`/factories/${factoryId}/algorithms/create`)}
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
              Create Algorithm
            </Button>
          </Stack >
        </Box >

        {/* Algorithm Grid */}
        < Grid container spacing={4} justifyContent="flex-start" >
          {
            algorithms.map((algo) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={algo.id}>
                <Card
                  sx={{
                    borderRadius: "24px",
                    height: "100%",
                    bgcolor: theme.paper,
                    border: `1px solid ${theme.border}`,
                    transition: "border-color 0.3s",
                    "&:hover": {
                      borderColor: theme.primary,
                      boxShadow: `0 25px 30px -5px ${alpha("#000", 0.08)}`,
                      "& .arrow-icon": { opacity: 1, transform: "translateX(0)" }
                    },
                  }}
                  elevation={0}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
                      <Box sx={{ p: 1, bgcolor: alpha(theme.primary, 0.08), borderRadius: "10px" }}>
                        <SchemaIcon sx={{ color: theme.primary, fontSize: 20 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAlgo(algo);
                          setEditName(algo.name);
                          setEditDescription(algo.description || "");
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
                      {algo.description || "No description provided for this algorithm."}
                    </Typography>

                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 3, borderTop: `1px solid ${theme.border}`, flexWrap: "wrap", gap: 1 }}>
                      <Stack direction="row" spacing={2}>
                        <Chip
                          label={`${algo.models_count} Active Models`}
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
                        onClick={() => navigate(`/factories/${factoryId}/algorithms/${algo.id}/models`)}
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
                        <Typography variant="button" fontWeight={700}>View Models</Typography>
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
              <Typography variant="h5" fontWeight={700} color={theme.textMain}>No algorithms found</Typography>
              <Typography variant="body1" color={theme.textMuted}>This factory is empty. Get started by creating your first algorithm architecture.</Typography>
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
          Update Architecture
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, mb: 1, display: 'block', textTransform: 'uppercase' }}>Algorithm Name</Typography>
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
          <Button onClick={() => setEditOpen(false)} sx={{ color: theme.textMuted, fontWeight: 700, px: 3, textTransform: 'none' }}>Cancel</Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!selectedAlgo) return;
              try {
                setSaving(true);
                const res = await axios.put(`/factories/${factoryId}/algorithms/${selectedAlgo.id}`, {
                  name: editName,
                  description: editDescription,
                });
                setAlgorithms((prev) => prev.map((a) => (a.id === selectedAlgo.id ? res.data : a)));
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
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem', color: theme.textMain }}>Permanently Delete?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: theme.textMuted, lineHeight: 1.6 }}>
            You are about to delete <strong>{selectedAlgo?.name}</strong>. This will orphan all associated models and experiments. This action cannot be reversed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 4 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ fontWeight: 700, color: theme.textMain, px: 3 }}>Keep it</Button>
          <Button
            variant="contained"
            color="error"
            sx={{ borderRadius: "12px", fontWeight: 700, px: 3, bgcolor: theme.danger }}
            onClick={async () => {
              if (!selectedAlgo) return;
              try {
                await axios.delete(`/factories/${factoryId}/algorithms/${selectedAlgo.id}`);
                setAlgorithms((prev) => prev.filter((a) => a.id !== selectedAlgo.id));
                setDeleteOpen(false);
              } catch (err) { console.error(err); }
            }}
          >
            Yes, Delete Algorithm
          </Button>
        </DialogActions>
      </Dialog >
    </Box >
  );
}