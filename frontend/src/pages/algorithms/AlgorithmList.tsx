"use client";

import { useEffect, useState } from "react";
import {
  Box,
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
  Grid,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import SchemaIcon from "@mui/icons-material/Schema";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

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
};

/* =======================
   Types
======================= */
interface Algorithm {
  id: number;
  name: string;
  description?: string;
  models_count: number;
  created_at: string;
}

export default function AlgorithmList() {
  const { factoryId } = useParams();
  const navigate = useNavigate();

  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [selectedAlgo, setSelectedAlgo] = useState<Algorithm | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    const fetchAlgorithms = async () => {
      try {
        const res = await axios.get(`/factories/${factoryId}/algorithms`);
        setAlgorithms(res.data);
      } catch (err) {
        console.error("Failed to load algorithms", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlgorithms();
  }, [factoryId]);

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
          <Grid  justifyContent="space-between" alignItems="flex-end" spacing={3}>
            <Grid size={{xs:12, md:8}}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <IconButton 
                  onClick={() => navigate(`/factories`)}
                  sx={{ 
                    bgcolor: themePalette.white, 
                    border: `1px solid ${themePalette.border}`,
                    "&:hover": { bgcolor: themePalette.primaryLight, color: themePalette.primary }
                  }}
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Typography variant="caption" fontWeight={700} sx={{ color: themePalette.primary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Factory Resource
                </Typography>
              </Stack>
              <Typography variant="h3" fontWeight={800} sx={{ color: themePalette.textMain, letterSpacing: "-0.02em", mb: 1 }}>
                Algorithm <Box component="span" sx={{ color: themePalette.primary }}>Library</Box>
              </Typography>
              <Typography variant="h6" sx={{ color: themePalette.textMuted, fontWeight: 400, maxWidth: 600 }}>
                Manage high-level architectural blueprints and view their associated production models.
              </Typography>
            </Grid>
              <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: { md: 'right' } }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate(`/factories/${factoryId}/algorithms/create`)}
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
                Create Algorithm
              </Button>
            </Grid>
          </Grid>
        </Box>

        {/* Algorithm Grid - Increased size to xs=12, sm=6, md=6 for larger cards */}
        <Grid container spacing={4} justifyContent="flex-start">
          {algorithms.map((algo) => (
            <Grid size={{xs:12, sm:12, md:6}} key={algo.id}>
              <motion.div whileHover={{ y: -8 }} transition={{ type: "spring", stiffness: 300 }}>
                <Card
                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algo.id}/models`)}
                  sx={{
                    borderRadius: "24px",
                    cursor: "pointer",
                    height: "100%",
                    minWidth: 450,
                    bgcolor: themePalette.white,
                    border: `1px solid ${themePalette.border}`,
                    transition: "border-color 0.3s",
                    "&:hover": {
                      borderColor: themePalette.primary,
                      boxShadow: `0 25px 30px -5px ${alpha("#000", 0.08)}`,
                      "& .arrow-icon": { opacity: 1, transform: "translateX(0)" }
                    },
                  }}
                  elevation={0}
                >
                  <CardContent sx={{ p: 5 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 4 }}>
                      <Box sx={{ p: 2, bgcolor: alpha(themePalette.primary, 0.08), borderRadius: "16px" }}>
                        <SchemaIcon sx={{ color: themePalette.primary, fontSize: 32 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton size="medium" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAlgo(algo);
                          setEditName(algo.name);
                          setEditDescription(algo.description || "");
                          setEditOpen(true);
                        }} sx={{ color: themePalette.textMuted, bgcolor: themePalette.background }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="medium" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAlgo(algo);
                          setDeleteOpen(true);
                        }} sx={{ color: alpha(themePalette.danger, 0.6), bgcolor: themePalette.background }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <Typography variant="h4" fontWeight={800} sx={{ color: themePalette.textMain, mb: 2 }}>
                      {algo.name}
                    </Typography>
                    
                    <Typography variant="body1" sx={{ color: themePalette.textMuted, mb: 4, minHeight: 60, lineHeight: 1.7, fontSize: '1.1rem' }}>
                      {algo.description || "No description provided for this algorithm."}
                    </Typography>

                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 3, borderTop: `1px solid ${themePalette.border}` }}>
                      <Stack direction="row" spacing={2}>
                        <Chip 
                          label={`${algo.models_count} Active Models`} 
                          sx={{ 
                            bgcolor: themePalette.primaryLight, 
                            color: themePalette.primary, 
                            fontWeight: 700, 
                            borderRadius: "10px",
                            px: 1,
                            py: 2
                          }} 
                        />
                         <Typography variant="caption" sx={{ color: themePalette.textMuted, alignSelf: 'center', fontWeight: 600 }}>
                         
                        </Typography>
                      </Stack>
                      
                      <Box className="arrow-icon" sx={{ opacity: 0, transform: "translateX(-10px)", transition: "all 0.3s", color: themePalette.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="button" fontWeight={700}>View Models</Typography>
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
        {algorithms.length === 0 && (
          <Paper variant="outlined" sx={{ py: 15, textAlign: 'center', borderRadius: '32px', borderStyle: 'dashed', bgcolor: 'transparent' }}>
            <SchemaIcon sx={{ fontSize: 64, color: alpha(themePalette.textMuted, 0.2), mb: 3 }} />
            <Typography variant="h5" fontWeight={700} color={themePalette.textMain}>No algorithms found</Typography>
            <Typography variant="body1" color={themePalette.textMuted}>This factory is empty. Get started by creating your first algorithm architecture.</Typography>
          </Paper>
        )}
      </Container>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} PaperProps={{ sx: { borderRadius: "24px", p: 2 } }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: themePalette.textMain, fontSize: '1.5rem' }}>Update Architecture</DialogTitle>
        <DialogContent>
          <TextField 
            fullWidth label="Algorithm Name" value={editName} onChange={(e) => setEditName(e.target.value)} 
            margin="normal" variant="outlined" sx={{ "& .MuiOutlinedInput-root": { borderRadius: "14px" } }} 
          />
          <TextField 
            fullWidth label="Description" multiline rows={4} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} 
            margin="normal" variant="outlined" sx={{ "& .MuiOutlinedInput-root": { borderRadius: "14px" } }} 
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: themePalette.textMuted, fontWeight: 700, px: 3 }}>Cancel</Button>
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
            variant="contained" sx={{ bgcolor: themePalette.primary, borderRadius: "12px", fontWeight: 700, px: 4, py: 1 }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} PaperProps={{ sx: { borderRadius: "24px" } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem' }}>Permanently Delete?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: themePalette.textMuted, lineHeight: 1.6 }}>
            You are about to delete <strong>{selectedAlgo?.name}</strong>. This will orphan all associated models and experiments. This action cannot be reversed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 4 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ fontWeight: 700, color: themePalette.textMain, px: 3 }}>Keep it</Button>
          <Button 
            variant="contained" 
            color="error" 
            sx={{ borderRadius: "12px", fontWeight: 700, px: 3, bgcolor: themePalette.danger }}
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
      </Dialog>
    </Box>
  );
}