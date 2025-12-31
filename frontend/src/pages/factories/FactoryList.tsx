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
} from "@mui/material";


import AddIcon from "@mui/icons-material/Add";
import FactoryIcon from "@mui/icons-material/Factory";
import SchemaIcon from "@mui/icons-material/Schema";
import HubIcon from "@mui/icons-material/Hub";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axios";

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

/* =======================
   Component
======================= */

export default function FactoryList() {
  const navigate = useNavigate();
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  /* ---------- Edit state ---------- */
  const [editOpen, setEditOpen] = useState(false);
  const [editingFactory, setEditingFactory] = useState<Factory | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  /* =======================
     Fetch factories
  ======================= */

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

  /* =======================
     Delete handler
  ======================= */

  const handleDelete = async (
    e: React.MouseEvent,
    factoryId: number
  ) => {
    e.stopPropagation();

    if (!confirm("Delete this factory and all its data?")) return;

    try {
      await axios.delete(`/factories/${factoryId}`);
      setFactories((prev) =>
        prev.filter((f) => f.id !== factoryId)
      );
    } catch (err) {
      console.error("Failed to delete factory", err);
    }
  };

  /* =======================
     Edit handlers
  ======================= */

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

    //  REFRESH FULL DATA (keeps counts correct)
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
          background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
        }}
      >
        <CircularProgress size={42}  sx={{ color: "#1976d2" }}/>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
        pb: 6,
      }}
    >
      <Container maxWidth="xl">
        <Box sx={{ pt: 6, pb: 4 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", sm: "center" },
              gap: 3,
              mb: 5,
            }}
          >
            <Box>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mb: 1,
                }}
              >
                Factories
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: "#666",
                  fontSize: "0.95rem",
                }}
              >
                Manage plants, algorithms, models & versions
              </Typography>
            </Box>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate("/factories/create")}
              sx={{
                background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                px: 4,
                py: 1.5,
                borderRadius: 3,
                fontWeight: 600,
                fontSize: "0.95rem",
                boxShadow: "0 8px 24px rgba(25, 118, 210, 0.3)",
                transition: "all 0.3s ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 12px 32px rgba(25, 118, 210, 0.4)",
                },
              }}
            >
              
              Create Factory
            </Button>
          </Box>

            <TextField
              placeholder="Search factories by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              variant="outlined"
              size="medium"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "#999", mr: 1 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                maxWidth: "400px",
                width: "100%",
                "& .MuiOutlinedInput-root": {
                  background: "white",
                  borderRadius: 2.5,
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                  fontSize: "0.95rem",
                  transition: "all 0.3s ease",
                  "& fieldset": {
                    borderColor: "#e0e0e0",
                    borderWidth: 1.5,
                  },
                  "&:hover fieldset": {
                    borderColor: "#1976d2",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#1976d2",
                    boxShadow: "0 0 0 3px rgba(25, 118, 210, 0.1)",
                  },
                },
              }}
            />
          </Box>
  
          {filteredFactories.length === 0 ? (
            <Box
              sx={{
                textAlign: "center",
                py: 15,
                px: 3,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  mb: 3,
                }}
              >
                <Box
                  sx={{
                    width: 100,
                    height: 100,
                    borderRadius: 3,
                    background: "linear-gradient(135deg, rgba(25, 118, 210, 0.15) 0%, rgba(21, 101, 192, 0.1) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FactoryIcon
                    sx={{
                      fontSize: 60,
                      color: "#1976d2",
                    }}
                  />
                </Box>
              </Box>
  
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: "#333",
                  mb: 1.5,
                }}
              >
                {searchQuery ? "No factories found" : "No factories created yet"}
              </Typography>
  
              <Typography
                variant="body1"
                sx={{
                  color: "#888",
                  mb: 4,
                  fontSize: "0.95rem",
                }}
              >
                {searchQuery
                  ? "Try adjusting your search terms"
                  : "Get started by creating your first factory"}
              </Typography>
  
              {!searchQuery && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate("/factories/create")}
                  sx={{
                    background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                    px: 4,
                    py: 1.5,
                    borderRadius: 2.5,
                    fontWeight: 600,
                    boxShadow: "0 8px 24px rgba(25, 118, 210, 0.3)",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "0 12px 32px rgba(25, 118, 210, 0.4)",
                    },
                  }}
                >
                  Create your first factory
                </Button>
              )}
          </Box>
        ) : (
          <Grid container spacing={3}>
            {filteredFactories.map((factory) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={factory.id}>
                <Card
                  onClick={() =>
                     navigate(`/factories/${factory.id}/algorithms`)
                  }
                  sx={{
                    borderRadius: 3,
                    cursor: "pointer",
                    height: "100%",
                    background: "white",
                    position: "relative",
                    overflow: "visible",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                    border: "1px solid rgba(0, 0, 0, 0.05)",
                    "&:hover": {
                      transform: "translateY(-8px)",
                      boxShadow: "0 16px 40px rgba(25, 118, 210, 0.2)",
                      borderColor: "rgba(25, 118, 210, 0.2)",
                      "& .factory-icon": {
                        transform: "scale(1.1)",
                      },
                      "& .action-buttons": {
                        opacity: 1,
                      },
                    },
                  }}
                >
                  <Box
                    sx={{
                      height: 4,
                      background: "linear-gradient(90deg, #1976d2 0%, #00bcd4 100%)",
                    }}
                  />

                  <CardContent sx={{ pb: 2.5 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        mb: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <Box
                          className="factory-icon"
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 1.75,
                            background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            boxShadow: "0 4px 12px rgba(25, 118, 210, 0.25)",
                            transition: "transform 0.3s ease",
                          }}
                        >
                          <FactoryIcon sx={{ color: "white", fontSize: 26 }} />
                        </Box>

                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 700,
                            color: "#222",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            transition: "color 0.3s ease",
                          }}
                        >
                          {factory.name}
                        </Typography>
                      </Box>

                      <Box
                        className="action-buttons"
                        sx={{
                          display: "flex",
                          gap: 0.5,
                          opacity: 0,
                          transition: "opacity 0.3s ease",
                          ml: 1,
                        }}
                      >
                        <Tooltip title="Edit Factory">
                          <IconButton
                            size="small"
                            onClick={(e) => openEdit(e, factory)}
                            sx={{
                              color: "#1976d2",
                              "&:hover": {
                                background: "rgba(25, 118, 210, 0.08)",
                              },
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete Factory">
                          <IconButton
                            size="small"
                            onClick={(e) => handleDelete(e, factory.id)}
                            sx={{
                              color: "#d32f2f",
                              "&:hover": {
                                background: "rgba(211, 47, 47, 0.08)",
                              },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Typography
                      variant="body2"
                      sx={{
                        color: "#666",
                        mb: 2.5,
                        minHeight: 40,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        lineHeight: 1.5,
                      }}
                    >
                      {factory.description || "No description provided"}
                    </Typography>

                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        mb: 2.5,
                        flexWrap: "wrap",
                      }}
                    >
                      <Chip
                        icon={<SchemaIcon />}
                        label={`${factory.algorithms_count} Algorithm${
                          factory.algorithms_count !== 1 ? "s" : ""
                        }`}
                        size="small"
                        sx={{
                          background: "linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(56, 142, 60, 0.1) 100%)",
                          color: "#388e3c",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          "& .MuiChip-icon": {
                            color: "#388e3c !important",
                          },
                        }}
                      />

                      <Chip
                        icon={<HubIcon />}
                        label={`${factory.models_count} Model${
                          factory.models_count !== 1 ? "s" : ""
                        }`}
                        size="small"
                        sx={{
                          background: "linear-gradient(135deg, rgba(255, 152, 0, 0.15) 0%, rgba(245, 127, 23, 0.1) 100%)",
                          color: "#f57c00",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          "& .MuiChip-icon": {
                            color: "#f57c00 !important",
                          },
                        }}
                      />
                    </Box>

                    <Box
                      sx={{
                        borderTop: "1px solid #f0f0f0",
                        pt: 2,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#999",
                          fontSize: "0.8rem",
                        }}
                      >
                        Created on{" "}
                        {new Date(factory.created_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 24px 48px rgba(0, 0, 0, 0.15)",
          },
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: 700,
            fontSize: "1.3rem",
            color: "#1976d2",
            background: "linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(21, 101, 192, 0.03) 100%)",
          }}
        >
          Edit Factory
          <IconButton
            onClick={() => setEditOpen(false)}
            size="small"
            sx={{ color: "#666" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3, pb: 2 }}>
          <TextField
            fullWidth
            label="Factory Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            variant="outlined"
            margin="normal"
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 1.5,
                transition: "all 0.3s ease",
                "& fieldset": {
                  borderColor: "#e0e0e0",
                },
                "&:hover fieldset": {
                  borderColor: "#1976d2",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#1976d2",
                },
              },
              "& .MuiInputBase-input": {
                fontSize: "0.95rem",
              },
            }}
          />

          <TextField
            fullWidth
            label="Description"
            multiline
            rows={4}
            value={editDescription}
            onChange={(e) =>
              setEditDescription(e.target.value)
            }
            variant="outlined"
            margin="normal"
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 1.5,
                transition: "all 0.3s ease",
                "& fieldset": {
                  borderColor: "#e0e0e0",
                },
                "&:hover fieldset": {
                  borderColor: "#1976d2",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#1976d2",
                },
              },
              "& .MuiInputBase-input": {
                fontSize: "0.95rem",
                fontFamily: "inherit",
              },
            }}
          />
        </DialogContent>

        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button
            onClick={() => setEditOpen(false)}
            variant="outlined"
            sx={{
              borderColor: "#e0e0e0",
              color: "#666",
              fontWeight: 600,
              borderRadius: 1.5,
              "&:hover": {
                borderColor: "#1976d2",
                color: "#1976d2",
                background: "rgba(25, 118, 210, 0.04)",
              },
            }}
          >
            Cancel
          </Button>

          <Button
            onClick={saveEdit}
            disabled={!editName.trim()}
            variant="contained"
            sx={{
              background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
              borderRadius: 1.5,
              fontWeight: 600,
              px: 3,
              boxShadow: "0 4px 12px rgba(25, 118, 210, 0.3)",
              transition: "all 0.3s ease",
              "&:hover": {
                boxShadow: "0 8px 20px rgba(25, 118, 210, 0.4)",
              },
              "&:disabled": {
                background: "#ccc",
                boxShadow: "none",
              },
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
