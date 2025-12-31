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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  InputAdornment,
  Container,
  alpha,
  Paper,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import FactoryIcon from "@mui/icons-material/Factory";
import SchemaIcon from "@mui/icons-material/Schema";
import HubIcon from "@mui/icons-material/Hub";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { useNavigate } from "react-router-dom";
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
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
};

/* =======================
   Types
======================= */
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

  const [editOpen, setEditOpen] = useState(false);
  const [editingFactory, setEditingFactory] = useState<Factory | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const fetchFactories = async () => {
    try {
      const res = await axios.get("/factories");
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

  const handleDelete = async (e: React.MouseEvent, factoryId: number) => {
    e.stopPropagation();
    if (!confirm("Delete this factory and all its data?")) return;
    try {
      await axios.delete(`/factories/${factoryId}`);
      setFactories((prev) => prev.filter((f) => f.id !== factoryId));
    } catch (err) {
      console.error("Failed to delete factory", err);
    }
  };

  const openEdit = (e: React.MouseEvent, factory: Factory) => {
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
      console.error("Failed to update factory", err);
    }
  };

  const filteredFactories = factories.filter(
    (factory) =>
      factory.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factory.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <Grid item>
              <Typography variant="h4" fontWeight={800} sx={{ color: themePalette.textMain, mb: 1, letterSpacing: "-0.02em" }}>
                Production <Box component="span" sx={{ color: themePalette.primary }}>Factories</Box>
              </Typography>
              <Typography variant="body1" sx={{ color: themePalette.textMuted, fontWeight: 500 }}>
                Oversee your ML production pipelines and model architectures.
              </Typography>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate("/factories/create")}
                sx={{
                  bgcolor: themePalette.primary,
                  px: 3,
                  py: 1.2,
                  borderRadius: "12px",
                  fontWeight: 700,
                  textTransform: "none",
                  boxShadow: `0 10px 15px -3px ${alpha(themePalette.primary, 0.3)}`,
                  "&:hover": { bgcolor: "#4338CA", transform: "translateY(-2px)" },
                  transition: "all 0.2s"
                }}
              >
                New Factory
              </Button>
            </Grid>
          </Grid>
        </Box>

        {/* Search Bar */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 0.5, 
            mb: 6, 
            borderRadius: "16px", 
            border: `1px solid ${themePalette.border}`,
            maxWidth: 500,
            bgcolor: "#fff"
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
            sx={{ "& .MuiInputBase-input": { py: 1.5, fontSize: "0.95rem" } }}
          />
        </Paper>

        {filteredFactories.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 12, bgcolor: "#fff", borderRadius: "24px", border: `1px dashed ${themePalette.border}` }}>
            <FactoryIcon sx={{ fontSize: 64, color: alpha(themePalette.primary, 0.2), mb: 2 }} />
            <Typography variant="h6" fontWeight={700} color={themePalette.textMain}>
              {searchQuery ? "No results found" : "No factories yet"}
            </Typography>
            <Typography variant="body2" color={themePalette.textMuted} sx={{ mb: 3 }}>
              {searchQuery ? "Try a different search term" : "Get started by creating your first production factory."}
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={4}>
            {filteredFactories.map((factory) => (
              <Grid item xs={12} sm={6} md={4} key={factory.id}>
                <Card
                  onClick={() => navigate(`/factories/${factory.id}/algorithms`)}
                  sx={{
                    borderRadius: "20px",
                    cursor: "pointer",
                    height: "100%",
                    bgcolor: "#fff",
                    border: `1px solid ${themePalette.border}`,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                      transform: "translateY(-6px)",
                      boxShadow: `0 20px 25px -5px ${alpha("#000", 0.05)}`,
                      borderColor: themePalette.primary,
                      "& .arrow-icon": { opacity: 1, transform: "translateX(0)" }
                    },
                  }}
                  elevation={0}
                >
                  <CardContent sx={{ p: 3.5 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
                      <Box sx={{ p: 1.5, bgcolor: alpha(themePalette.primary, 0.1), borderRadius: "12px" }}>
                        <FactoryIcon sx={{ color: themePalette.primary, fontSize: 28 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" onClick={(e) => openEdit(e, factory)} sx={{ color: themePalette.textMuted }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => handleDelete(e, factory.id)} sx={{ color: alpha(themePalette.danger, 0.7) }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <Typography variant="h6" fontWeight={800} sx={{ color: themePalette.textMain, mb: 1 }}>
                      {factory.name}
                    </Typography>
                    
                    <Typography variant="body2" sx={{ color: themePalette.textMuted, mb: 3, minHeight: 40, lineHeight: 1.6 }}>
                      {factory.description || "No description provided for this factory."}
                    </Typography>

                    <Box sx={{ display: "flex", gap: 1.5, mb: 4 }}>
                      <Chip 
                        icon={<SchemaIcon style={{ fontSize: 16 }} />} 
                        label={`${factory.algorithms_count} Algos`} 
                        size="small" 
                        sx={{ bgcolor: alpha(themePalette.success, 0.1), color: themePalette.success, fontWeight: 700, borderRadius: "8px" }} 
                      />
                      <Chip 
                        icon={<HubIcon style={{ fontSize: 16 }} />} 
                        label={`${factory.models_count} Models`} 
                        size="small" 
                        sx={{ bgcolor: alpha(themePalette.warning, 0.1), color: themePalette.warning, fontWeight: 700, borderRadius: "8px" }} 
                      />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 2, borderTop: `1px solid ${themePalette.border}` }}>
                      <Typography variant="caption" sx={{ color: themePalette.textMuted, fontWeight: 600 }}>
                        ID: #{factory.id.toString().padStart(3, '0')}
                      </Typography>
                      <Box className="arrow-icon" sx={{ opacity: 0, transform: "translateX(-10px)", transition: "all 0.3s", display: 'flex', alignItems: 'center', color: themePalette.primary }}>
                        <Typography variant="caption" fontWeight={700} sx={{ mr: 0.5 }}>View</Typography>
                        <ArrowForwardIcon fontSize="small" />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} PaperProps={{ sx: { borderRadius: "20px", p: 1 } }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: themePalette.textMain }}>Edit Factory</DialogTitle>
        <DialogContent>
          <TextField 
            fullWidth label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} 
            margin="normal" variant="outlined" sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }} 
          />
          <TextField 
            fullWidth label="Description" multiline rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} 
            margin="normal" variant="outlined" sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }} 
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: themePalette.textMuted, fontWeight: 700 }}>Cancel</Button>
          <Button 
            onClick={saveEdit} variant="contained" 
            sx={{ bgcolor: themePalette.primary, borderRadius: "10px", fontWeight: 700, px: 3 }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}