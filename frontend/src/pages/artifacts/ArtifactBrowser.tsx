"use client";

import { useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, Button, Grid, Chip,
  IconButton, Container, Stack, Paper, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  alpha, InputBase
} from "@mui/material";
import {
  Add as AddIcon,
  Folder as FolderIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  InfoOutlined as InfoIcon
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axios";

import { useTheme } from "../../theme/ThemeContext";

export default function ArtifactBrowser() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [algorithms, setAlgorithms] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [newAlgoName, setNewAlgoName] = useState("");
  const [newAlgoDesc, setNewAlgoDesc] = useState("");

  const [editAlgo, setEditAlgo] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [viewAlgo, setViewAlgo] = useState<any | null>(null);

  const [deleteAlgoId, setDeleteAlgoId] = useState<number | null>(null);
  const [deleteAlgoName, setDeleteAlgoName] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Fetch logic
  const fetchAlgorithms = async () => {
    try {
      const res = await axios.get("/kb/algorithms");
      setAlgorithms(res.data);
    } catch (e) {
      console.error("Failed to fetch algorithms", e);
    }
  };

  useEffect(() => {
    fetchAlgorithms();
  }, []);

  // Update logic
  const handleUpdateAlgo = async () => {
    if (!editAlgo) return;
    try {
      await axios.put(`/kb/algorithms/${editAlgo.id}`, {
        name: editName,
        description: editDescription,
      });
      setEditAlgo(null);
      fetchAlgorithms();
    } catch (e) { console.error(e); }
  };

  // Create logic
  const handleCreateAlgo = async () => {
    if (!newAlgoName.trim()) return;
    try {
      await axios.post("/kb/algorithms", {
        name: newAlgoName,
        description: newAlgoDesc,
      });

      setNewAlgoName("");
      setNewAlgoDesc("");
      setOpenModal(false);
      fetchAlgorithms();
    } catch (e) { console.error(e); }
  };

  return (
    <Box sx={{ height: "100vh", bgcolor: theme.background, overflow: "hidden", display: "flex", flexDirection: "column" }}>

      {/* HEADER: Glassmorphism effect consistent with VersionTimeline */}
      <Box sx={{
        flexShrink: 0,
        bgcolor: alpha(theme.background, 0.8),
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${alpha(theme.border, 0.6)}`,
        zIndex: 10
      }}>
        <Container maxWidth={false} sx={{ py: 4 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">

            <Stack direction="row" alignItems="center" spacing={2}>
              {/* Page Title */}
              <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: "-0.02em", color: theme.textMain }}>
                Artifact <Box component="span" sx={{ color: theme.primary }}>Browser</Box>
              </Typography>
            </Stack>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenModal(true)}
              sx={{
                bgcolor: theme.primary,
                borderRadius: "10px",
                px: 4,
                py: 1,
                fontWeight: 700,
                textTransform: "none",
                boxShadow: `0 4px 14px ${alpha(theme.primary, 0.3)}`,
                "&:hover": { bgcolor: theme.primaryDark, transform: "translateY(-1px)", boxShadow: `0 6px 20px ${alpha(theme.primary, 0.4)}` },
                transition: "all 0.2s"
              }}
            >
              New Repository
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* SCROLLABLE CONTENT */}
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        <Container maxWidth={false} sx={{ py: 6 }}>

          {/* SLEEK SEARCH BAR */}
          <Paper
            component="form"
            elevation={0}
            sx={{
              p: "4px 8px",
              display: "flex",
              alignItems: "center",
              width: "100%",
              maxWidth: 600, // Reduced MAX WIDTH for sleekness
              mb: 8,
              borderRadius: "50px", // Pill shape
              border: `1px solid ${theme.border}`,
              bgcolor: theme.surface,
              transition: "all 0.2s",
              "&:hover": {
                borderColor: theme.primary,
                boxShadow: `0 4px 12px ${alpha(theme.textMain, 0.05)}`
              },
              "&:focus-within": {
                borderColor: theme.primary,
                boxShadow: `0 4px 12px ${alpha(theme.primary, 0.15)}`,
                transform: "scale(1.01)"
              }
            }}
          >
            <IconButton sx={{ p: "10px", color: theme.textMuted }} aria-label="search">
              <SearchIcon />
            </IconButton>
            <InputBase
              sx={{ ml: 1, flex: 1, fontWeight: 500, color: theme.textMain }}
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Paper>

          {/* REPOSITORY GRID */}
          <Grid container spacing={3}>
            {algorithms.length === 0 ? (
              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  py: 12,
                  opacity: 0.7
                }}
              >
                <FolderIcon sx={{ fontSize: 64, color: theme.textMuted, mb: 2, opacity: 0.5 }} />
                <Typography variant="h6" fontWeight={700} sx={{ color: theme.textMain, mb: 1 }}>
                  No Repositories Found
                </Typography>
                <Typography variant="body2" sx={{ color: theme.textMuted, maxWidth: 400, textAlign: "center" }}>
                  Create your first knowledge repository to start organizing artifacts and documentation.
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenModal(true)}
                  sx={{
                    mt: 4,
                    borderRadius: "12px",
                    fontWeight: 700,
                    color: theme.primary,
                    borderColor: theme.border,
                    textTransform: "none",
                    "&:hover": { borderColor: theme.primary, bgcolor: alpha(theme.primary, 0.05) }
                  }}
                >
                  Create Repository
                </Button>
              </Box>
            ) : (
              algorithms
                .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
                .map((algo) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={algo.id}>
                    <Card
                      elevation={0}
                      sx={{
                        height: "100%",
                        borderRadius: "20px",
                        border: `1px solid ${theme.border}`,
                        bgcolor: theme.surface,
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        display: "flex",
                        flexDirection: "column",
                        "&:hover": {
                          boxShadow: `0 12px 24px -8px ${alpha(theme.textMain, 0.08)}`,
                          borderColor: theme.primary
                        }
                      }}
                    >
                      <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column" }}>

                        {/* Card Header: Icon + Actions */}
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                          <Box sx={{
                            p: 1.5,
                            borderRadius: "14px",
                            bgcolor: alpha(theme.primary, 0.1),
                            color: theme.primary,
                            display: "inline-flex"
                          }}>
                            <FolderIcon sx={{ fontSize: 32 }} />
                          </Box>

                          <Stack direction="row" spacing={0.5}>
                            <IconButton size="small" onClick={() => setViewAlgo(algo)} sx={{ color: theme.textSecondary }}>
                              <InfoIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => {
                              setEditAlgo(algo);
                              setEditName(algo.name);
                              setEditDescription(algo.description || "");
                            }} sx={{ color: theme.textSecondary }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => {
                              setDeleteAlgoId(algo.id);
                              setDeleteAlgoName(algo.name);
                            }} sx={{ color: alpha(theme.error || theme.danger, 0.7), "&:hover": { color: theme.error || theme.danger } }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>

                        {/* Card Body */}
                        <Typography variant="h6" fontWeight={600} noWrap sx={{ color: theme.textMain, mb: 0.5 }}>
                          {algo.name}
                        </Typography>

                        <Typography
                          variant="body2"
                          sx={{
                            color: theme.textMuted,
                            flex: 1,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            lineHeight: '1.6em',
                            minHeight: '4.8em',
                            mb: 2
                          }}
                        >
                          {algo.description || "No description provided."}
                        </Typography>

                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: "auto", pt: 2, borderTop: `1px solid ${theme.border}` }}>
                          <Chip
                            label={`${algo.file_count || 0} Files`}
                            size="small"
                            sx={{ bgcolor: theme.background, fontWeight: 700, color: theme.textSecondary }}
                          />
                          <Button
                            variant="text"
                            onClick={() => navigate(`/artifacts/algorithms/${algo.id}`)}
                            sx={{ fontWeight: 700, color: theme.primary, textTransform: "none" }}
                          >
                            Open Repository
                          </Button>
                        </Stack>

                      </CardContent>
                    </Card>
                  </Grid>
                ))
            )}
          </Grid>

        </Container>
      </Box>

      {/* --- DIALOGS --- */}

      {/* CREATE DIALOG */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        PaperProps={{ sx: { borderRadius: "24px", p: 1, minWidth: 400, bgcolor: theme.paper } }}
      >
        <DialogTitle fontWeight={900} sx={{ pb: 1, color: theme.textMain }}>
          New Repository
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Repository Name"
            value={newAlgoName}
            onChange={(e) => setNewAlgoName(e.target.value)}
            sx={{
              mt: 1, mb: 3,
              "& .MuiOutlinedInput-root": { color: theme.textMain, borderRadius: "12px", "& fieldset": { borderColor: theme.border } },
              "& .MuiInputLabel-root": { color: theme.textMuted }
            }}
          />
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={3}
            value={newAlgoDesc}
            onChange={(e) => setNewAlgoDesc(e.target.value)}
            placeholder="What is this algorithm for?"
            sx={{
              "& .MuiOutlinedInput-root": { color: theme.textMain, borderRadius: "12px", "& fieldset": { borderColor: theme.border } },
              "& .MuiInputLabel-root": { color: theme.textMuted }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenModal(false)} sx={{ fontWeight: 700, color: theme.textMuted }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateAlgo} sx={{ borderRadius: "10px", fontWeight: 700, px: 3, bgcolor: theme.primary }}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog
        open={!!editAlgo}
        onClose={() => setEditAlgo(null)}
        PaperProps={{ sx: { borderRadius: "24px", p: 1, minWidth: 500, bgcolor: theme.background } }}
      >
        <DialogTitle sx={{ fontWeight: 900, color: theme.textMain, letterSpacing: "-0.02em", pt: 3 }}>
          Edit Repository
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, mb: 1, display: 'block', textTransform: 'uppercase' }}>Repository Name</Typography>
              <TextField
                fullWidth
                variant="outlined"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": { borderRadius: "12px", bgcolor: theme.paper, color: theme.textMain },
                }}
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
                sx={{
                  "& .MuiOutlinedInput-root": { borderRadius: "12px", bgcolor: theme.paper, color: theme.textMain },
                }}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setEditAlgo(null)} sx={{ fontWeight: 700, color: theme.textMuted, textTransform: 'none', px: 3 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateAlgo}
            sx={{
              borderRadius: "12px",
              fontWeight: 700,
              px: 4,
              py: 1.2,
              bgcolor: theme.primary,
              textTransform: 'none',
              boxShadow: `0 8px 16px -4px ${alpha(theme.primary, 0.3)}`
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* VIEW DIALOG */}
      <Dialog
        open={!!viewAlgo}
        onClose={() => setViewAlgo(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: "28px", p: 1, bgcolor: theme.background } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ p: 1.5, bgcolor: alpha(theme.primary, 0.1), borderRadius: "14px", display: "flex", color: theme.primary }}>
              <FolderIcon />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={900} sx={{ lineHeight: 1, color: theme.textMain }}>Repository Details</Typography>
              <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 700 }}>READ MODE</Typography>
            </Box>
          </Stack>
          <IconButton onClick={() => setViewAlgo(null)} sx={{ bgcolor: theme.surface, border: `1px solid ${theme.border}` }}>
            <InfoIcon sx={{ color: theme.textMuted }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 4, pb: 4 }}>
          <Stack spacing={4}>
            <Box>
              <Typography variant="overline" fontWeight={800} sx={{ color: theme.textMuted, letterSpacing: "0.05em", mb: 1, display: 'block' }}>
                REPOSITORY NAME
              </Typography>
              <Typography variant="h4" fontWeight={800} sx={{ color: theme.textMain, letterSpacing: "-0.02em" }}>
                {viewAlgo?.name}
              </Typography>
            </Box>

            <Box>
              <Typography variant="overline" fontWeight={800} sx={{ color: theme.textMuted, letterSpacing: "0.05em", mb: 1.5, display: 'block' }}>
                DESCRIPTION
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: "20px",
                  bgcolor: theme.paper,
                  border: `1px solid ${theme.border}`,
                  minHeight: 120
                }}
              >
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8, color: theme.textMain }}>
                  {viewAlgo?.description || "No description available for this repository."}
                </Typography>
              </Paper>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 4, pb: 4 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setViewAlgo(null)}
            sx={{
              borderRadius: "14px",
              py: 1.5,
              fontWeight: 800,
              border: `2px solid ${alpha(theme.border, 0.8)}`,
              color: theme.textMain,
              textTransform: 'none',
              "&:hover": { bgcolor: theme.surface, borderColor: theme.textMuted }
            }}
          >
            Close Viewer
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog
        open={deleteAlgoId !== null}
        onClose={() => setDeleteAlgoId(null)}
        PaperProps={{ sx: { borderRadius: "24px", p: 2, bgcolor: theme.paper } }}
      >
        <DialogTitle fontWeight={900} sx={{ color: theme.error }}>
          Delete Repository?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: theme.textSecondary }}>
            Are you sure you want to delete <strong>{deleteAlgoName}</strong>?
          </Typography>
          <Typography variant="caption" sx={{ display: "block", mt: 2, color: theme.textMuted }}>
            This action is permanent and will remove all uploaded documents.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pt: 2 }}>
          <Button onClick={() => setDeleteAlgoId(null)} sx={{ fontWeight: 700, color: theme.textMuted }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleting}
            onClick={async () => {
              if (!deleteAlgoId) return;
              try {
                setDeleting(true);
                await axios.delete(`/kb/algorithms/${deleteAlgoId}`);
                await fetchAlgorithms();
              } finally {
                setDeleting(false);
                setDeleteAlgoId(null);
              }
            }}
            sx={{ borderRadius: "10px", fontWeight: 700, px: 3, bgcolor: theme.error }}
          >
            {deleting ? "Deleting..." : "Delete Permanently"}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
