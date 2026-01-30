"use client";

import { useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, Button, Grid, Chip,
  IconButton, Container, Stack, Paper, TextField, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions
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

const themePalette = {
  primary: "#4F46E5",
  textMain: "#1E293B",
  textMuted: "#64748B",
  background: "#F8FAFC",
  border: "#E2E8F0",
};

export default function ArtifactBrowser() {
  const navigate = useNavigate();

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

  const fetchAlgorithms = async () => {
    const res = await axios.get("/kb/algorithms");
    setAlgorithms(res.data);
  };

  

  const handleUpdateAlgo = async () => {
        if (!editAlgo) return;

        await axios.put(`/kb/algorithms/${editAlgo.id}`, {
          name: editName,
          description: editDescription,
        });

        setEditAlgo(null);
        fetchAlgorithms();
      };


  useEffect(() => {
    fetchAlgorithms();
  }, []);


  const handleCreateAlgo = async () => {
      if (!newAlgoName.trim()) return;

      await axios.post("/kb/algorithms", {
        name: newAlgoName,
        description: newAlgoDesc,
      });

      setNewAlgoName("");
      setNewAlgoDesc("");
      setOpenModal(false);
      fetchAlgorithms();
    };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: themePalette.background, pb: 10 }}>
      <Container maxWidth="xl">

        {/* HEADER */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ pt: 6, pb: 4 }}
        >
          <Typography variant="h3" fontWeight={900}>
            Algorithms{" "}
            <Box component="span" sx={{ color: themePalette.primary }}>
              Artifacts
            </Box>
          </Typography>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenModal(true)}
            sx={{
              bgcolor: themePalette.primary,
              borderRadius: "12px",
              px: 4,
              fontWeight: 700,
            }}
          >
            Create Algorithm
          </Button>
        </Stack>

        {/* SEARCH */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 4,
            borderRadius: "16px",
            border: `1px solid ${themePalette.border}`,
          }}
        >
          <TextField
            fullWidth
            placeholder="Search algorithm repositories..."
            variant="standard"
            InputProps={{
              disableUnderline: true,
              startAdornment: (
                <SearchIcon sx={{ mr: 1, color: themePalette.textMuted }} />
              ),
            }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Paper>

        {/* ALGORITHM GRID */}
       <Grid container spacing={3} justifyContent="flex-start">
          {algorithms
            .filter((a) =>
              a.name.toLowerCase().includes(search.toLowerCase())
            )
            .map((algo) => (
              <Grid size={{xs:12, sm:6, md:4}} key={algo.id}>
                <Card elevation={0} sx={{
                  borderRadius: "20px",
                  border: `1px solid ${themePalette.border}`,
                  transition: "0.2s",
                  display: 'flex', // Ensures card height is consistent
                  flexDirection: 'column',
                  "&:hover": { transform: "translateY(-4px)", borderColor: themePalette.primary }
                }}>
                  <CardContent sx={{ p: 3 }}>
                    
                    {/* TOP ACTIONS */}
                    <Stack direction="row" justifyContent="space-between">
                      <FolderIcon sx={{ fontSize: 42, color: themePalette.primary }} />

                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small" onClick={() => setViewAlgo(algo)}>
                          <InfoIcon fontSize="small" />
                        </IconButton>

                        <IconButton size="small" onClick={() => {
                            setEditAlgo(algo);
                            setEditName(algo.name);
                            setEditDescription(algo.description || "");
                          }}>

                          <EditIcon fontSize="small" />
                        </IconButton>

                        <IconButton
                          color="error"
                          onClick={() => {
                            setDeleteAlgoId(algo.id);
                            setDeleteAlgoName(algo.name);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>

                      </Stack>
                    </Stack>

                    <Typography variant="h6" fontWeight={800} noWrap>
                      {algo.name}
                    </Typography>

                    <Typography
              variant="body2"
              sx={{
                color: themePalette.textMuted,
                mt: 1,
                mb: 2,
                // These are the key properties:
                whiteSpace: "pre-wrap",    // Respects line breaks (Enters)
                wordBreak: "break-word",   // Prevents horizontal stretching
                display: "-webkit-box",
                WebkitLineClamp: 3,        // Limits card preview to 3 lines
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: '1.5em',
                minHeight: '4.5em'         // Ensures cards are same height
              }}
            >
              {algo.description || "No description provided"}
            </Typography>


                    <Typography variant="caption" color="text.secondary">
                      {algo.file_count || 0} Documents
                    </Typography>

                    <Button
                      fullWidth
                      sx={{ mt: 3 }}
                      variant="outlined"
                      onClick={() => navigate(`/artifacts/algorithms/${algo.id}`)}
                    >
                      Open Repository
                    </Button>
                  </CardContent>
                </Card>

              </Grid>
            ))}
        </Grid>
      </Container>

      {/* CREATE ALGORITHM MODAL */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        PaperProps={{ sx: { borderRadius: "24px", p: 1 } }}
      >
        <DialogTitle fontWeight={900}>
          Create Algorithm Repository
        </DialogTitle>

        <DialogContent>
          <TextField
            fullWidth
            label="Algorithm Name"
            value={newAlgoName}
            onChange={(e) => setNewAlgoName(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Description"
            multiline
            rows={3}
            value={newAlgoDesc}
            onChange={(e) => setNewAlgoDesc(e.target.value)}
            placeholder="Explain what this algorithm does..."
          />

        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateAlgo}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

    <Dialog 
              open={!!editAlgo} 
              onClose={() => setEditAlgo(null)}
              // Increased border radius for consistency with the main dashboard
              PaperProps={{ sx: { borderRadius: "28px", p: 2, width: '100%', maxWidth: '450px' } }}
            >
              <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
                <Typography variant="h4" fontWeight={900}>Edit Repository</Typography>
              </DialogTitle>
              
              <DialogContent sx={{ mt: 1 }}> {/* Added margin top to prevent label overlap with title */}
                <TextField
                  fullWidth
                  label="Algorithm Name"
                  variant="outlined" // Outlined variants handle labels better in tight spaces
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  sx={{ 
                    mt: 2, // Ensures the label has breathing room
                    mb: 3, 
                    "& .MuiOutlinedInput-root": { borderRadius: '12px' } 
                  }}
                />

                <TextField
                  fullWidth
                  label="Description"
                  variant="outlined"
                  multiline
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Briefly describe the algorithm's purpose..."
                  sx={{ 
                    "& .MuiOutlinedInput-root": { borderRadius: '12px' } 
                  }}
                />
              </DialogContent>

              <DialogActions sx={{ p: 3, justifyContent: 'center', gap: 2 }}>
                <Button 
                  onClick={() => setEditAlgo(null)}
                  sx={{ fontWeight: 700, color: themePalette.textMuted, textTransform: 'none' }}
                >
                  Cancel
                </Button>
                <Button 
                  variant="contained" 
                  onClick={handleUpdateAlgo}
                  sx={{ 
                    borderRadius: '12px', 
                    px: 4, 
                    fontWeight: 800, 
                    textTransform: 'none',
                    bgcolor: themePalette.primary,
                    boxShadow: `0 8px 16px ${(themePalette.primary, 0.2)}`
                  }}
                >
                  Save Changes
                </Button>
              </DialogActions>
            </Dialog>


           <Dialog 
  open={!!viewAlgo} 
  onClose={() => setViewAlgo(null)}
  maxWidth="md" // Increases default width from 'sm' to 'md'
  fullWidth // Ensures it takes up the full 'md' width
  PaperProps={{ 
    sx: { 
      borderRadius: "28px", 
      p: 1,
      backgroundImage: 'none' // Ensures clean background on dark mode
    } 
  }}
>
  <DialogTitle sx={{ pb: 1, pt: 3, px: 4 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="h4" fontWeight={900} sx={{ color: themePalette.textMain }}>
        Repository <Box component="span" sx={{ color: themePalette.primary }}>Insights</Box>
      </Typography>
      <Chip 
       
        size="small" 
        sx={{ fontWeight: 800, bgcolor: themePalette.background, color: themePalette.textMuted }} 
      />
    </Stack>
  </DialogTitle>

  <DialogContent sx={{ px: 4, py: 2 }}>
    <Stack spacing={3}>
      {/* ALGORITHM NAME SECTION */}
      <Box>
        <Typography variant="overline" fontWeight={800} color="primary" sx={{ letterSpacing: 1 }}>
          Algorithm Title
        </Typography>
        <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
          {viewAlgo?.name}
        </Typography>
      </Box>

      <Divider />

      {/* DESCRIPTION SECTION - Info Box Style */}
      <Box>
        <Typography variant="overline" fontWeight={800} color="text.secondary" sx={{ letterSpacing: 1 }}>
          Full Description & Purpose
        </Typography>
        <Paper 
          elevation={0} 
          sx={{ 
            mt: 1.5, 
            p: 3, 
            bgcolor: (themePalette.primary, 0.03), 
            borderRadius: '16px',
            border: `1px solid ${(themePalette.primary, 0.1)}`,
          }}
        >
          <Typography
            variant="body1"
            sx={{ 
              color: themePalette.textMain, 
              lineHeight: 1.8, 
              whiteSpace: "pre-wrap",
              wordBreak: "break-word" 
            }}
          >
            {viewAlgo?.description || "No detailed description has been provided for this algorithm repository yet."}
          </Typography>
        </Paper>
      </Box>

      {/* FOOTER STATS */}
      <Stack direction="row" spacing={4} sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, bgcolor: themePalette.primary, borderRadius: '10px', display: 'flex', color: themePalette.primary }}>
            <FolderIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ display: 'block' }}>
              RESOURCES
            </Typography>
            <Typography variant="body2" fontWeight={800}>
              {viewAlgo?.file_count || 0} Documents Stored
            </Typography>
          </Box>
        </Box>
        
        {/* Additional metadata can go here */}
      </Stack>
    </Stack>
  </DialogContent>

  <DialogActions sx={{ p: 4, pt: 2 }}>
    <Button 
      fullWidth
      variant="contained" 
      onClick={() => setViewAlgo(null)}
      sx={{ 
        py: 1.5,
        borderRadius: '12px', 
        fontWeight: 800,
        textTransform: 'none',
        bgcolor: themePalette.textMain,
        "&:hover": { bgcolor: "#000" }
      }}
    >
      Close Details
    </Button>
  </DialogActions>
</Dialog>

      <Dialog
            open={deleteAlgoId !== null}
            onClose={() => setDeleteAlgoId(null)}
            PaperProps={{
              sx: { borderRadius: "20px", p: 1 },
            }}
          >
            <DialogTitle fontWeight={900} color="error">
              Delete Algorithm Repository
            </DialogTitle>

            <DialogContent>
              <Typography sx={{ mt: 1 }}>
                Are you sure you want to permanently delete
              </Typography>

              <Typography fontWeight={800} sx={{ mt: 1 }}>
                “{deleteAlgoName}”
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                This will remove:
                <br />• All uploaded documents
                <br />• Repository metadata
                <br />• This action cannot be undone
              </Typography>
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
              <Button
                onClick={() => setDeleteAlgoId(null)}
                sx={{ fontWeight: 700 }}
              >
                Cancel
              </Button>

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
              >
                Delete Repository
              </Button>
            </DialogActions>
          </Dialog>

    </Box>

    
  );
}

