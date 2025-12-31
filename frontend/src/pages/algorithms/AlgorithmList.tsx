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
import SchemaIcon from "@mui/icons-material/Schema";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

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

/* =======================
   Component
======================= */

export default function AlgorithmList() {
  const { factoryId } = useParams();
  const navigate = useNavigate();

  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [loading, setLoading] = useState(true);

  /* Edit dialog state */
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAlgo, setSelectedAlgo] = useState<Algorithm | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  /* Delete dialog state */
  const [deleteOpen, setDeleteOpen] = useState(false);

  /* =======================
     Fetch algorithms
  ======================= */

  useEffect(() => {
    const fetchAlgorithms = async () => {
      try {
        const res = await axios.get(
          `/factories/${factoryId}/algorithms`
        );
        setAlgorithms(res.data);
      } catch (err) {
        console.error("Failed to load algorithms", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlgorithms();
  }, [factoryId]);

  /* =======================
     Loading State
  ======================= */

  if (loading) {
    return (
      <Box sx={{ height: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={42} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* =======================
          Header
      ======================= */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/factories/${factoryId}`)}
          sx={{ mr: 2 }}
        >
          Back
        </Button>

        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight={700}>
            Algorithms
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage algorithms and their models
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate(`/factories/${factoryId}/algorithms/create`)}
        >
          Create Algorithm
        </Button>
      </Box>

      {/* =======================
          Algorithm Cards
      ======================= */}
      <Grid container spacing={3}>
        {algorithms.map((algo) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={algo.id}>
            <motion.div whileHover={{ scale: 1.03 }}>
             <Card
              elevation={2}
              sx={{
                borderRadius: 3,
                cursor: "pointer",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={() =>
                navigate(`/factories/${factoryId}/algorithms/${algo.id}/models`)
              }
            >
              <CardContent sx={{ flexGrow: 1 }}>
                {/* HEADER ROW */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    mb: 1,
                  }}
                >
                  {/* TITLE */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <SchemaIcon color="primary" />
                    <Typography
                      variant="h6"
                      fontWeight={600}
                      noWrap
                      title={algo.name}
                    >
                      {algo.name}
                    </Typography>
                  </Box>

                  {/* ACTIONS */}
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAlgo(algo);
                        setEditName(algo.name);
                        setEditDescription(algo.description || "");
                        setEditOpen(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>

                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAlgo(algo);
                        setDeleteOpen(true);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                {/* DESCRIPTION */}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    minHeight: 44,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {algo.description || "No description provided"}
                </Typography>

                {/* FOOTER */}
                <Box sx={{ mt: 2 }}>
                  <Chip
                    label={`${algo.models_count} Models`}
                    size="small"
                  />

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1 }}
                  >
                    Created on {new Date(algo.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* =======================
          EDIT DIALOG
      ======================= */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Algorithm</DialogTitle>

        <DialogContent>
          <TextField
            label="Algorithm Name"
            fullWidth
            sx={{ mt: 1 }}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />

          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            sx={{ mt: 2 }}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>

          <Button
            variant="contained"
            disabled={saving}
            onClick={async () => {
              if (!selectedAlgo) return;
              try {
                setSaving(true);

                const res = await axios.put(
                  `/factories/${factoryId}/algorithms/${selectedAlgo.id}`,
                  {
                    name: editName,
                    description: editDescription,
                  }
                );

                setAlgorithms((prev) =>
                  prev.map((a) => (a.id === selectedAlgo.id ? res.data : a))
                );

                setEditOpen(false);
              } catch (err) {
                console.error("Failed to update algorithm", err);
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* =======================
          DELETE DIALOG
      ======================= */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Algorithm</DialogTitle>

        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            <strong>{selectedAlgo?.name}</strong>?
            <br />
            This action cannot be undone.
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>

          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (!selectedAlgo) return;
              try {
                await axios.delete(
                  `/factories/${factoryId}/algorithms/${selectedAlgo.id}`
                );

                setAlgorithms((prev) =>
                  prev.filter((a) => a.id !== selectedAlgo.id)
                );

                setDeleteOpen(false);
              } catch (err) {
                console.error("Failed to delete algorithm", err);
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
