"use client";

import {
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Stack,
  Box,
} from "@mui/material";

import ReplayIcon from "@mui/icons-material/Replay";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteIcon from "@mui/icons-material/Delete";

import { useNavigate } from "react-router-dom";

/* =======================
   Types
======================= */

interface Version {
  id: number;
  version_number: number;
  note?: string;
  is_active: boolean;
  created_at: string;
}

interface Props {
  versions: Version[];
  basePath: string;
  onRollback?: (versionId: number) => void;
  onDelete: (versionId: number) => void;
}

/* =======================
   Component
======================= */

export default function VersionsDashboard({
  versions,
  basePath,
  onRollback,
  onDelete,
}: Props) {
  const navigate = useNavigate();
  
  return (
    
    <Stack spacing={2}>
      {versions.map((v) => (
        <Card
          key={v.id}
          sx={{
            borderLeft: "6px solid",
            borderLeftColor: v.is_active ? "success.main" : "divider",
            backgroundColor: v.is_active
              ? "rgba(46, 125, 50, 0.05)"
              : "background.paper",
          }}
        >
          <CardContent>
            {/* ================= Header ================= */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <Box>
                <Typography fontWeight={600}>
                  Version v{v.version_number}
                </Typography>

                {v.note && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {v.note}
                  </Typography>
                )}
              </Box>

              {v.is_active && (
                <Chip label="ACTIVE" color="success" size="small" />
              )}
            </Box>

            {/* ================= Meta ================= */}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={new Date(v.created_at).toLocaleString()}
              />
            </Stack>

            {/* ================= Actions ================= */}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
  <Button
    size="small"
    startIcon={<VisibilityIcon />}
    onClick={() => navigate(`${basePath}/${v.id}`)}
  >
    Details
  </Button>

  {!v.is_active && onRollback && (
    <Button
      size="small"
      color="warning"
      startIcon={<ReplayIcon />}
      onClick={() => onRollback(v.id)}
    >
      Rollback
    </Button>
  )}

  {/* ✅ DELETE BUTTON FIX */}
  <Button
    size="small"
    color="error"
    startIcon={<DeleteIcon />}
    disabled={v.is_active && versions.length > 1}
    onClick={() => {
      if (!confirm(`Delete version v${v.version_number}?`)) return;
      onDelete(v.id);
    }}
  >
    Delete
  </Button>
</Stack>

          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
