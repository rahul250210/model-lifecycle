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
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import HubIcon from "@mui/icons-material/Hub";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

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

/* =======================
   Component
======================= */

export default function ModelList() {
  const { factoryId, algorithmId } = useParams();
  const navigate = useNavigate();

  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  /* Edit dialog */
  const [editOpen, setEditOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  /* Delete dialog */
  const [deleteOpen, setDeleteOpen] = useState(false);

  /* =======================
     Fetch models
  ======================= */

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

  useEffect(() => {
    fetchModels();
  }, [factoryId, algorithmId]);

  /* =======================
     Handlers
  ======================= */

  const openEdit = (model: Model) => {
    setSelectedModel(model);
    setEditName(model.name);
    setEditDescription(model.description || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedModel) return;

    try {
      setSaving(true);
      await axios.put(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${selectedModel.id}`,
        {
          name: editName,
          description: editDescription,
        }
      );
      setEditOpen(false);
      fetchModels();
    } catch {
      alert("Failed to update model");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedModel) return;

    try {
      await axios.delete(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${selectedModel.id}`
      );
      setDeleteOpen(false);
      fetchModels();
    } catch (err: any) {
      alert(
        err?.response?.data?.detail ||
          "Cannot delete model with existing versions"
      );
    }
  };

  /* =======================
     Loading
  ======================= */

  if (loading) {
    return (
      <Box
        sx={{
          height: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress size={42} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/factories/${factoryId}/algorithms`)}
          sx={{ mr: 2 }}
        >
          Back
        </Button>

        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight={700}>
            Models
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track, version and manage ML models
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() =>
            navigate(
              `/factories/${factoryId}/algorithms/${algorithmId}/models/create`
            )
          }
        >
          Create Model
        </Button>
      </Box>

      {/* Model Cards */}
      <Grid container spacing={3}>
        {models.map((model) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={model.id}>
            <motion.div whileHover={{ scale: 1.03 }}>
              <Card
                elevation={2}
                sx={{
                  borderRadius: 3,
                  height: "100%",
                  position: "relative",
                }}
              >
                {/* ACTION BUTTONS */}
                <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEdit(model);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>

                  <IconButton
                    size="small"
                    color="error"
                    
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedModel(model);
                      setDeleteOpen(true);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* NAVIGATION ONLY HERE */}
                <CardContent
                  sx={{ cursor: "pointer" }}
                  onClick={() =>
                    navigate(
                      `/factories/${factoryId}/algorithms/${algorithmId}/models/${model.id}/versions`
                    )
                  }
                >
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                    <HubIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6" fontWeight={600}>
                      {model.name}
                    </Typography>
                  </Box>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ minHeight: 40 }}
                  >
                    {model.description || "No description provided"}
                  </Typography>

                  <Chip
                    label={`${model.versions_count} Versions`}
                    size="small"
                    sx={{ mt: 2 }}
                  />

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 2 }}
                  >
                    Created on{" "}
                    {new Date(model.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* EDIT DIALOG */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogTitle>Edit Model</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Model Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={3}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={saving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
  <DialogTitle>Delete Model</DialogTitle>

  <DialogContent>
    {selectedModel?.versions_count ? (
      <Typography color="error">
        This model contains{" "}
        <b>{selectedModel.versions_count}</b> version(s).
        <br />
        Deleting this model will permanently delete all its versions.
        <br />
        <br />
        Do you still want to continue?
      </Typography>
    ) : (
      <Typography>
        Are you sure you want to delete this model?
      </Typography>
    )}
  </DialogContent>

  <DialogActions>
    <Button onClick={() => setDeleteOpen(false)}>
      Cancel
    </Button>

    <Button
      color="error"
      variant="contained"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        confirmDelete();
      }}
    >
      Delete Anyway
    </Button>
  </DialogActions>
</Dialog>

    </Box>
  );
}
