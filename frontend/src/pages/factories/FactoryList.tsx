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
  
  InputAdornment,
  Container,
  alpha,
  Paper,
  CardActionArea,
  Stack,
  Divider,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import AddIcon from "@mui/icons-material/Add";
import FactoryIcon from "@mui/icons-material/Factory";
import SchemaIcon from "@mui/icons-material/Schema";
import HubIcon from "@mui/icons-material/Hub";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import { useNavigate } from "react-router-dom";
import axios from "../../api/axios";

/* ==========================================================================
   THEME PALETTE
========================================================================== */
const themePalette = {
  primary: "#4F46E5",
  primaryLight: "#EEF2FF",
  textMain: "#1E293B",
  textMuted: "#64748B",
  background: "#F8FAFC",
  border: "#E2E8F0",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
   white: "#FFFFFF",
};

/* ==========================================================================
   TYPES
========================================================================== */
interface Factory {
  id: number;
  name: string;
  description?: string;
  algorithms_count: number;
  models_count: number;
  created_at: string;
}

export default function FactoryList() {
  const navigate = useNavigate();
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit Dialog States
  const [editOpen, setEditOpen] = useState(false);
  const [editingFactory, setEditingFactory] = useState<Factory | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Delete Dialog States
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [factoryToDelete, setFactoryToDelete] = useState<Factory | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchFactories = async () => {
    try {
      const res = await axios.get("/factories/");
      setFactories(res.data);
    } catch (err) {
      console.error("Failed to load factories", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFactories();
  }, []);

  /* =======================
     HANDLERS
  ======================= */

  const openDeleteConfirm = (e: React.MouseEvent, factory: Factory) => {
    e.preventDefault();
    e.stopPropagation();
    setFactoryToDelete(factory);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!factoryToDelete) return;
    try {
      setDeleteLoading(true);
      await axios.delete(`/factories/${factoryToDelete.id}`);
      setFactories((prev) => prev.filter((f) => f.id !== factoryToDelete.id));
      setDeleteOpen(false);
      setFactoryToDelete(null);
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEdit = (e: React.MouseEvent, factory: Factory) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingFactory(factory);
    setEditName(factory.name);
    setEditDescription(factory.description || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editingFactory) return;
    try {
      await axios.put(`/factories/${editingFactory.id}`, {
        name: editName,
        description: editDescription,
      });
      await fetchFactories();
      setEditOpen(false);
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  const filteredFactories = factories.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Box sx={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: themePalette.background }}>
        <CircularProgress size={40} sx={{ color: themePalette.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: themePalette.background, pb: 10 }}>
      <Container maxWidth="xl">
        {/* Header Section */}
        <Box sx={{ pt: 6, pb: 6 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={3}>
            <Box>
              <Typography variant="h3" fontWeight={900} sx={{ color: themePalette.textMain, letterSpacing: "-0.04em" }}>
                Production <Box component="span" sx={{ color: themePalette.primary }}>Factories</Box>
              </Typography>
              <Typography variant="body1" sx={{ color: themePalette.textMuted, mt: 1, fontWeight: 500 }}>
                Manage your high-level infrastructure clusters and pipeline nodes.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate("/factories/create")}
              sx={{
                bgcolor: themePalette.primary,
                borderRadius: "14px",
                px: 4,
                py: 1.5,
                fontWeight: 800,
                textTransform: "none",
                boxShadow: `0 10px 15px -3px ${alpha(themePalette.primary, 0.3)}`,
                "&:hover": { bgcolor: "#4338CA", transform: "translateY(-2px)" },
                transition: "all 0.2s",
              }}
            >
              New Factory
            </Button>
          </Stack>
        </Box>

        {/* Search Bar Section */}
        <Paper
          elevation={0}
          sx={{
            p: 1,
            mb: 6,
            borderRadius: "16px",
            border: `1px solid ${themePalette.border}`,
            bgcolor: themePalette.white,
            maxWidth: 600,
          }}
        >
          <TextField
            fullWidth
            placeholder="Search factories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              startAdornment: (
                <InputAdornment position="start" sx={{ pl: 2 }}>
                  <SearchIcon sx={{ color: themePalette.textMuted }} />
                </InputAdornment>
              ),
            }}
            sx={{ "& .MuiInputBase-input": { py: 1, fontSize: "1rem" } }}
          />
        </Paper>

        {/* Main Grid */}
        {filteredFactories.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center', bgcolor: alpha(themePalette.white, 0.5), borderRadius: '32px', border: `2px dashed ${themePalette.border}` }}>
            <FactoryIcon sx={{ fontSize: 64, color: alpha(themePalette.textMuted, 0.2), mb: 2 }} />
            <Typography variant="h6" fontWeight={700} color={themePalette.textMain}>No factories match your search</Typography>
            <Typography variant="body2" color={themePalette.textMuted}>Try adjusting your filters or create a new cluster.</Typography>
          </Box>
        ) : (
          <Grid container spacing={4}>
            {filteredFactories.map((factory) => (
              <Grid item xs={12} sm={12} md={6} key={factory.id}>
                <Card 
                  elevation={0}
                  sx={{ 
                    borderRadius: "24px", 
                    border: `1px solid ${themePalette.border}`,
                    height: "100%",
                    minWidth: 400,
                    bgcolor: themePalette.white,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": { 
                      borderColor: themePalette.primary,
                      boxShadow: `0 20px 25px -5px ${alpha("#000", 0.05)}`,
                      transform: "translateY(-6px)"
                    }
                  }}
                >
                  {/* Card Actions (Edit/Delete) */}
                  <Box sx={{ px: 3, pt: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box sx={{ p: 1, bgcolor: alpha(themePalette.primary, 0.1), borderRadius: "10px", display: 'flex' }}>
                      <FactoryIcon sx={{ color: themePalette.primary, fontSize: 20 }} />
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={(e) => openEdit(e, factory)} sx={{ mr: 0.5 }}>
                        <EditIcon fontSize="small" sx={{ color: themePalette.textMuted }} />
                      </IconButton>
                      <IconButton size="small" onClick={(e) => openDeleteConfirm(e, factory)} sx={{ color: alpha(themePalette.danger, 0.7) }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <CardActionArea 
                    onClick={() => navigate(`/factories/${factory.id}/algorithms`)}
                    sx={{ "& .MuiCardActionArea-focusHighlight": { bgcolor: "transparent" } }}
                  >
                    <CardContent sx={{ px: 3, pb: 4 }}>
                      <Typography variant="h5" fontWeight={800} sx={{ color: themePalette.textMain, mb: 1 }}>
                        {factory.name}
                      </Typography>

                      <Typography variant="body2" sx={{ color: themePalette.textMuted, mb: 3, minHeight: 40, lineHeight: 1.6 }}>
                        {factory.description || "No specific configuration summary provided for this factory node."}
                      </Typography>

                      <Stack direction="row" spacing={1.5} sx={{ mb: 3 }}>
                        <Chip 
                          icon={<SchemaIcon sx={{ fontSize: '14px !important' }} />} 
                          label={`${factory.algorithms_count} Algos`} 
                          size="small" 
                          sx={{ bgcolor: alpha(themePalette.success, 0.08), color: themePalette.success, fontWeight: 700, borderRadius: '8px' }} 
                        />
                        <Chip 
                          icon={<HubIcon sx={{ fontSize: '14px !important' }} />} 
                          label={`${factory.models_count} Models`} 
                          size="small" 
                          sx={{ bgcolor: alpha(themePalette.warning, 0.08), color: themePalette.warning, fontWeight: 700, borderRadius: '8px' }} 
                        />
                      </Stack>

                      <Divider sx={{ mb: 2, borderColor: alpha(themePalette.border, 0.5) }} />

                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="caption" fontWeight={700} sx={{ color: themePalette.textMuted, textTransform: 'uppercase' }}>
                         
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', color: themePalette.primary, gap: 0.5 }}>
                           <Typography variant="button" fontWeight={800} sx={{ fontSize: '0.7rem' }}>ENTER</Typography>
                           <ArrowForwardIcon sx={{ fontSize: 16 }} />
                        </Box>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Modern Edit Dialog */}
      <Dialog 
        open={editOpen} 
        onClose={() => setEditOpen(false)}
        PaperProps={{ sx: { borderRadius: "24px", p: 1, maxWidth: 450, width: '100%' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: themePalette.textMain }}>Edit Configuration</DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField 
              fullWidth 
              label="Factory Name" 
              variant="outlined"
              value={editName} 
              onChange={(e) => setEditName(e.target.value)} 
              InputProps={{ sx: { borderRadius: '12px' } }}
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={4}
              variant="outlined"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              InputProps={{ sx: { borderRadius: '12px' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: themePalette.textMuted, fontWeight: 700, textTransform: 'none' }}>Cancel</Button>
          <Button 
            onClick={saveEdit} 
            variant="contained" 
            sx={{ bgcolor: themePalette.primary, borderRadius: '10px', px: 4, fontWeight: 700, textTransform: 'none' }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modern Delete Confirmation Dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => !deleteLoading && setDeleteOpen(false)}
        PaperProps={{ sx: { borderRadius: "28px", p: 1, maxWidth: 400 } }}
      >
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Box sx={{ 
            width: 64, 
            height: 64, 
            borderRadius: '20px', 
            bgcolor: alpha(themePalette.danger, 0.1), 
            color: themePalette.danger,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2
          }}>
            <WarningAmberIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h5" fontWeight={900} sx={{ color: themePalette.textMain, mb: 1 }}>
            Delete Factory?
          </Typography>
          <Typography variant="body2" sx={{ color: themePalette.textMuted, lineHeight: 1.6 }}>
            Are you sure you want to delete <strong>{factoryToDelete?.name}</strong>? This action will permanently remove all associated algorithms and models.
          </Typography>
        </Box>
        <DialogActions sx={{ p: 3, justifyContent: 'center', gap: 2 }}>
          <Button 
            fullWidth
            onClick={() => setDeleteOpen(false)} 
            disabled={deleteLoading}
            sx={{ color: themePalette.textMuted, fontWeight: 800, textTransform: 'none', py: 1.2, borderRadius: '12px', border: `1px solid ${themePalette.border}` }}
          >
            Keep Factory
          </Button>
          <Button 
            fullWidth
            onClick={handleDelete} 
            variant="contained" 
            disabled={deleteLoading}
            sx={{ 
              bgcolor: themePalette.danger, 
              borderRadius: '12px', 
              fontWeight: 800, 
              textTransform: 'none',
              py: 1.2,
              "&:hover": { bgcolor: "#DC2626" },
              boxShadow: `0 8px 16px -4px ${alpha(themePalette.danger, 0.4)}`
            }}
          >
            {deleteLoading ? <CircularProgress size={24} color="inherit" /> : "Yes, Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}