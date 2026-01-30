"use client";

import { useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, Button, IconButton,
  Container, Stack, Paper, alpha, CircularProgress, Chip, CardMedia
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  PictureAsPdf,
  Slideshow,
  Description,
  Download,
  Delete,
  UploadFile,
  Category as CategoryIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

/* ==========================================================================
   THEME & HELPERS
========================================================================== */
const themePalette = {
  primary: "#4F46E5",
  textMain: "#1E293B",
  textMuted: "#64748B",
  background: "#F8FAFC",
  border: "#E2E8F0",
  danger: "#EF4444",
  white: "#FFFFFF",
};

const getFileCategory = (name: string) => {
  const ext = name.toLowerCase().split('.').pop();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext!)) return "Photos & Images";
  if (['ppt', 'pptx'].includes(ext!)) return "Presentations (PPT)";
  if (['pdf'].includes(ext!)) return "PDF Documents";
  return "Other Resources";
};

export default function AlgorithmArtifactPage() {
  const { algorithmId } = useParams();
  const navigate = useNavigate();

  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchFiles = async () => {
    try {
      const res = await axios.get(`/kb/algorithms/${algorithmId}/files`);
      setFiles(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchFiles(); }, [algorithmId]);

  /* ==========================================================================
     MULTIPLE UPLOAD HANDLER
  ========================================================================== */
  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList) return;
    
    const uploadedFiles = Array.from(fileList);
    try {
      setUploading(true);
      // Upload files sequentially or use Promise.all for parallel
      for (const file of uploadedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        await axios.post(`/kb/algorithms/${algorithmId}/files`, formData);
      }
      await fetchFiles();
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete artifact?")) return;
    await axios.delete(`/kb/files/${id}`);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const groupedFiles = files.reduce((acc: any, file) => {
    const cat = getFileCategory(file.name);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(file);
    return acc;
  }, {});

  const renderPreview = (file: any) => {
    const name = file.name.toLowerCase();
    const isImage = name.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    const isPdf = name.endsWith(".pdf");
    const isPpt = name.endsWith(".ppt") || name.endsWith(".pptx");

    if (isImage) {
      return (
        <CardMedia
          component="img"
          height="140"
          image={`http://127.0.0.1:8000${file.url}`}
          alt={file.name}
          sx={{ objectFit: "cover" }}
        />
      );
    }

    return (
      <Box sx={{ 
        height: 140, display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center',
        bgcolor: isPdf ? alpha("#E11D48", 0.05) : isPpt ? alpha("#D97706", 0.05) : alpha(themePalette.primary, 0.05),
      }}>
        {isPdf && <PictureAsPdf sx={{ fontSize: 40, color: "#E11D48" }} />}
        {isPpt && <Slideshow sx={{ fontSize: 40, color: "#D97706" }} />}
        {!isPdf && !isPpt && <Description sx={{ fontSize: 40, color: themePalette.primary }} />}
        <Typography variant="overline" mt={0.5} fontWeight={900} color="text.secondary">
          {name.split('.').pop()?.toUpperCase()}
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: themePalette.background, pb: 10 }}>
      <Container maxWidth="xl">
        
        {/* HEADER */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 8, pb: 6 }}>
          <Stack direction="row" spacing={3} alignItems="center">
            <IconButton onClick={() => navigate("/artifacts")} sx={{ bgcolor: themePalette.white, border: `1px solid ${themePalette.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Box>
              <Typography variant="h2" fontWeight={900} sx={{ color: themePalette.textMain, letterSpacing: "-0.04em" }}>
                Knowledge Repo
              </Typography>
              <Typography variant="body1" sx={{ color: themePalette.textMuted, fontWeight: 500 }}>
                Algorithm Assets <Box component="span" sx={{ color: themePalette.primary, fontWeight: 700 }}></Box>
              </Typography>
            </Box>
          </Stack>

          <Button
            component="label"
            variant="contained"
            disabled={uploading}
            startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <UploadFile />}
            sx={{ bgcolor: themePalette.primary, borderRadius: "14px", px: 4, py: 1.5, fontWeight: 800, textTransform: "none", boxShadow: `0 10px 15px -3px ${alpha(themePalette.primary, 0.3)}` }}
          >
            {uploading ? "Uploading..." : "Upload Multiple Files"}
            {/* Added 'multiple' attribute here */}
            <input 
              hidden 
              type="file" 
              multiple 
              onChange={(e) => handleUpload(e.target.files)} 
            />
          </Button>
        </Stack>

        {Object.keys(groupedFiles).length === 0 ? (
          <Paper variant="outlined" sx={{ py: 12, textAlign: 'center', borderRadius: '40px', borderStyle: 'dashed', bgcolor: alpha(themePalette.white, 0.5) }}>
             <Typography variant="h5" fontWeight={800} color="text.secondary">No assets found.</Typography>
          </Paper>
        ) : (
          Object.keys(groupedFiles).map((category) => (
            <Box key={category} sx={{ mb: 10 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <CategoryIcon sx={{ color: themePalette.primary, fontSize: 28 }} />
                <Typography variant="h4" fontWeight={900} sx={{ color: themePalette.textMain }}>{category}</Typography>
                <Chip label={`${groupedFiles[category].length} items`} size="small" sx={{ fontWeight: 800, bgcolor: themePalette.primary, color: 'white' }} />
              </Stack>
              
              {/* HORIZONTAL SCROLL CONTAINER */}
              <Box 
                sx={{ 
                  display: 'flex', 
                  gap: 3, 
                  overflowX: 'auto', 
                  pb: 3, // Space for the scrollbar
                  px: 1,
                  '&::-webkit-scrollbar': { height: '8px' },
                  '&::-webkit-scrollbar-thumb': { 
                    bgcolor: alpha(themePalette.primary, 0.2), 
                    borderRadius: '10px',
                    '&:hover': { bgcolor: alpha(themePalette.primary, 0.4) }
                  },
                  '&::-webkit-scrollbar-track': { bgcolor: alpha(themePalette.border, 0.5), borderRadius: '10px' }
                }}
              >
                {groupedFiles[category].map((file: any) => (
                  <Card 
                    key={file.id}
                    elevation={0} 
                    sx={{ 
                        minWidth: 260, // Fixed width for horizontal items
                        maxWidth: 260,
                        borderRadius: "20px", 
                        border: `1px solid ${themePalette.border}`, 
                        transition: "all 0.3s ease", 
                        overflow: 'hidden',
                        bgcolor: themePalette.white,
                        flexShrink: 0, // Prevent cards from squishing
                        "&:hover": { borderColor: themePalette.primary, transform: "translateY(-8px)", boxShadow: `0 15px 30px -10px ${alpha(themePalette.textMain, 0.1)}` } 
                    }}
                  >
                    {renderPreview(file)}
                    <CardContent sx={{ p: 2.5 }}>
                      <Typography variant="body2" fontWeight={800} sx={{ color: themePalette.textMain, mb: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button 
                          fullWidth variant="contained" size="small" startIcon={<Download />}
                          href={`http://127.0.0.1:8000${file.url}`}
                          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, bgcolor: alpha(themePalette.primary, 0.1), color: themePalette.primary, boxShadow: 'none', "&:hover": { bgcolor: themePalette.primary, color: 'white' } }}
                        >
                          Get
                        </Button>
                        <IconButton size="small" onClick={() => handleDelete(file.id)} sx={{ border: `1px solid ${themePalette.border}`, color: alpha(themePalette.danger, 0.6) }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          ))
        )}
      </Container>
    </Box>
  );
}