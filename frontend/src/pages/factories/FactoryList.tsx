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
  Stack,
  Divider,
  Grid,
} from "@mui/material";
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

import { useTheme } from "../../theme/ThemeContext";

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
  const { theme } = useTheme();
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
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={3}>
            <Box>
              <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: "-0.04em" }}>
                Production <Box component="span" sx={{ color: theme.primary }}>Factories</Box>
              </Typography>
              <Typography variant="body1" sx={{ color: theme.textMuted, mt: 1, fontWeight: 500 }}>
                Manage your high-level infrastructure clusters and pipeline nodes.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate("/factories/create")}
              sx={{
                bgcolor: theme.primary,
                borderRadius: "14px",
                px: 4,
                py: 1.5,
                fontWeight: 800,
                textTransform: "none",
                boxShadow: `0 10px 15px -3px ${alpha(theme.primary, 0.3)}`,
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
            border: `1px solid ${theme.border}`,
            bgcolor: theme.paper,
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
                  <SearchIcon sx={{ color: theme.textMuted }} />
                </InputAdornment>
              ),
            }}
            sx={{ "& .MuiInputBase-input": { py: 1, fontSize: "1rem", color: theme.textMain } }}
          />
        </Paper>

        {/* Main Grid */}
        {filteredFactories.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center', bgcolor: alpha(theme.paper, 0.5), borderRadius: '32px', border: `2px dashed ${theme.border}` }}>
            <FactoryIcon sx={{ fontSize: 64, color: alpha(theme.textMuted, 0.2), mb: 2 }} />
            <Typography variant="h6" fontWeight={700} color={theme.textMain}>No factories match your search</Typography>
            <Typography variant="body2" color={theme.textMuted}>Try adjusting your filters or create a new cluster.</Typography>
          </Box>
        ) : (
          <Grid container spacing={4}>
            {filteredFactories.map((factory) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={factory.id}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: "24px",
                    border: `1px solid ${theme.border}`,
                    height: "100%",
                    bgcolor: theme.paper,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                      borderColor: theme.primary,
                      boxShadow: `0 20px 25px -5px ${alpha("#000", 0.05)}`,
                      "& .arrow-icon": { opacity: 1, transform: "translateX(0)" }
                    }
                  }}
                >
                  {/* Card Actions (Edit/Delete) */}
                  <Box sx={{ px: 3, pt: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box sx={{ p: 1, bgcolor: alpha(theme.primary, 0.1), borderRadius: "10px", display: 'flex' }}>
                      <FactoryIcon sx={{ color: theme.primary, fontSize: 20 }} />
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={(e) => openEdit(e, factory)} sx={{ mr: 0.5 }}>
                        <EditIcon fontSize="small" sx={{ color: theme.textMuted }} />
                      </IconButton>
                      <IconButton size="small" onClick={(e) => openDeleteConfirm(e, factory)} sx={{ color: alpha(theme.danger, 0.7) }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h5" fontWeight={600} sx={{ color: theme.textMain, mb: 1 }}>
                      {factory.name}
                    </Typography>

                    <Typography variant="body2" sx={{ color: theme.textMuted, mb: 3, minHeight: 40, lineHeight: 1.6 }}>
                      {factory.description || "No summary provided for this factory."}
                    </Typography>

                    <Stack direction="row" spacing={1.5} sx={{ mb: 3 }}>
                      <Chip
                        icon={<SchemaIcon sx={{ fontSize: '14px !important' }} />}
                        label={`${factory.algorithms_count} Algos`}
                        size="small"
                        sx={{ bgcolor: alpha(theme.success, 0.08), color: theme.success, fontWeight: 700, borderRadius: '8px' }}
                      />
                      <Chip
                        icon={<HubIcon sx={{ fontSize: '14px !important' }} />}
                        label={`${factory.models_count} Models`}
                        size="small"
                        sx={{ bgcolor: alpha(theme.warning, 0.08), color: theme.warning, fontWeight: 700, borderRadius: '8px' }}
                      />
                    </Stack>

                    <Divider sx={{ mb: 2, borderColor: alpha(theme.border, 0.5) }} />

                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, textTransform: 'uppercase' }}>

                      </Typography>
                      <Box
                        onClick={() => navigate(`/factories/${factory.id}/algorithms`)}
                        className="arrow-icon"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          color: theme.primary,
                          gap: 0.5,
                          cursor: 'pointer',
                          p: 0.5,
                          borderRadius: '4px',
                          opacity: 0,
                          transform: "translateX(-10px)",
                          transition: "all 0.3s",
                          '&:hover': {
                            bgcolor: alpha(theme.primary, 0.1)
                          }
                        }}
                      >
                        <Typography variant="button" fontWeight={800} sx={{ fontSize: '0.7rem' }}>ENTER</Typography>
                        <ArrowForwardIcon sx={{ fontSize: 16 }} />
                      </Box>
                    </Box>
                  </CardContent>
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
        PaperProps={{ sx: { borderRadius: "24px", p: 1, maxWidth: 500, width: '100%', bgcolor: theme.background } }}
      >
        <DialogTitle sx={{ fontWeight: 900, color: theme.textMain, letterSpacing: "-0.02em", pt: 3 }}>
          Edit Configuration
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, mb: 1, display: 'block', textTransform: 'uppercase' }}>Factory Name</Typography>
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
            onClick={saveEdit}
            variant="contained"
            sx={{ bgcolor: theme.primary, borderRadius: '12px', px: 4, py: 1.2, fontWeight: 700, textTransform: 'none', boxShadow: `0 8px 16px -4px ${alpha(theme.primary, 0.3)}` }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modern Delete Confirmation Dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => !deleteLoading && setDeleteOpen(false)}
        PaperProps={{ sx: { borderRadius: "28px", p: 1, maxWidth: 400, bgcolor: theme.paper } }}
      >
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Box sx={{
            width: 64,
            height: 64,
            borderRadius: '20px',
            bgcolor: alpha(theme.danger, 0.1),
            color: theme.danger,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2
          }}>
            <WarningAmberIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, mb: 1 }}>
            Delete Factory?
          </Typography>
          <Typography variant="body2" sx={{ color: theme.textMuted, lineHeight: 1.6 }}>
            Are you sure you want to delete <strong>{factoryToDelete?.name}</strong>? This action will permanently remove all associated algorithms and models.
          </Typography>
        </Box>
        <DialogActions sx={{ p: 3, justifyContent: 'center', gap: 2 }}>
          <Button
            fullWidth
            onClick={() => setDeleteOpen(false)}
            disabled={deleteLoading}
            sx={{ color: theme.textMuted, fontWeight: 800, textTransform: 'none', py: 1.2, borderRadius: '12px', border: `1px solid ${theme.border}` }}
          >
            Keep Factory
          </Button>
          <Button
            fullWidth
            onClick={handleDelete}
            variant="contained"
            disabled={deleteLoading}
            sx={{
              bgcolor: theme.danger,
              borderRadius: '12px',
              fontWeight: 800,
              textTransform: 'none',
              py: 1.2,
              "&:hover": { bgcolor: "#DC2626" },
              boxShadow: `0 8px 16px -4px ${alpha(theme.danger, 0.4)}`
            }}
          >
            {deleteLoading ? <CircularProgress size={24} color="inherit" /> : "Yes, Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}