"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Button,
  CircularProgress,
  Stack,
  alpha,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SpeedIcon from '@mui/icons-material/Speed';

import LayersIcon from '@mui/icons-material/Layers';
import HistoryIcon from '@mui/icons-material/History';
import GridViewIcon from '@mui/icons-material/GridView';

import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../../theme/ThemeContext";
import axios from "../../api/axios";

// --- Types ---
interface DashboardData {
  stats: {
    algorithms: number;
    models: number;
    versions: number;
    avg_inference_time: string;
  };
  distribution: { name: string; value: number }[];
  recent_activity: {
    id: number;
    version: string;
    model_name: string;
    algo_name: string;
    created_at: string;
    link_ids: {
      factory_id: number;
      algo_id: number;
      model_id: number;
      version_id: number;
    }
  }[];
  resource_trends: {
    algorithm: string;
    avg_cpu: number;
    avg_gpu: number;
  }[];
}

interface Factory {
  id: number;
  name: string;
  description?: string;
}

// --- Components ---

const StatCard = ({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) => {
  const { theme } = useTheme();
  return (
    <Paper elevation={0} sx={{
      p: 3,
      borderRadius: "16px",
      bgcolor: alpha(theme.paper, 0.6),
      border: `1px solid ${theme.border}`,
      display: "flex",
      alignItems: "center",
      gap: 2,
      transition: "all 0.2s",
      "&:hover": { transform: "translateY(-4px)", boxShadow: `0 8px 20px ${alpha(color, 0.15)}`, borderColor: color }
    }}>
      <Box sx={{
        p: 1.5,
        borderRadius: "12px",
        bgcolor: alpha(color, 0.1),
        color: color,
        display: "flex"
      }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h4" fontWeight={800} sx={{ color: theme.textMain }}>{value}</Typography>
        <Typography variant="body2" fontWeight={600} sx={{ color: theme.textMuted }}>{title}</Typography>
      </Box>
    </Paper>
  );
};

export default function FactoryOverview() {
  const { factoryId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [factory, setFactory] = useState<Factory | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [factoryRes, dashRes] = await Promise.all([
          axios.get(`/factories/${factoryId}`),
          axios.get(`/factories/${factoryId}/dashboard`),
        ]);
        setFactory(factoryRes.data);
        setData(dashRes.data);
      } catch (err) {
        console.error("Failed to load dashboard", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [factoryId]);

  if (loading || !factory || !data) {
    return <Box sx={{ height: "70vh", display: "flex", justifyContent: "center", alignItems: "center" }}><CircularProgress /></Box>;
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <Box sx={{ p: 4, maxWidth: "1600px", margin: "0 auto" }}>
      {/* HEADER */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/factories")} sx={{ color: theme.textMuted }}>Back</Button>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: theme.textMain }}>{factory.name}</Typography>
            <Typography variant="body2" sx={{ color: theme.textMuted }}>Factory Dashboard & Overview</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<GridViewIcon />}
            onClick={() => navigate(`/factories/${factory.id}/algorithms`)}
            sx={{ borderRadius: "10px", fontWeight: 600, borderColor: theme.border, color: theme.textMain }}
          >
            View All Algorithms
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate(`/factories/${factory.id}/algorithms/create`)}
            sx={{ borderRadius: "10px", fontWeight: 600, bgcolor: theme.primary }}
          >
            New Algorithm
          </Button>
        </Stack>
      </Stack>

      {/* VITALS GRID */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Algorithms" value={data.stats.algorithms} icon={<GridViewIcon fontSize="large" />} color="#0088FE" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Total Models" value={data.stats.models} icon={<LayersIcon fontSize="large" />} color="#00C49F" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Total Versions" value={data.stats.versions} icon={<HistoryIcon fontSize="large" />} color="#FFBB28" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Avg Inference" value={data.stats.avg_inference_time} icon={<SpeedIcon fontSize="large" />} color="#FF8042" />
        </Grid>
      </Grid>

      {/* CHARTS SECTION */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* ASSET DISTRIBUTION PIE */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{
            p: 3,
            borderRadius: "16px",
            bgcolor: alpha(theme.paper, 0.4),
            border: `1px solid ${theme.border}`,
            height: "400px"
          }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 3 }}>Asset Distribution</Typography>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={data.distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label
                >
                  {data.distribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: theme.paper, borderRadius: "8px", border: `1px solid ${theme.border}` }}
                  itemStyle={{ color: theme.textMain }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* RESOURCE TRENDS BAR */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{
            p: 3,
            borderRadius: "16px",
            bgcolor: alpha(theme.paper, 0.4),
            border: `1px solid ${theme.border}`,
            height: "400px"
          }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Resource Requirements (Avg)</Typography>
            <Typography variant="caption" sx={{ color: theme.textMuted, mb: 3, display: "block" }}>
              Top algorithms by CPU usage (%)
            </Typography>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={data.resource_trends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                <XAxis dataKey="algorithm" stroke={theme.textMuted} tick={{ fill: theme.textMuted }} />
                <YAxis stroke={theme.textMuted} tick={{ fill: theme.textMuted }} />
                <Tooltip
                  cursor={{ fill: alpha(theme.textMuted, 0.1) }}
                  contentStyle={{ backgroundColor: theme.paper, borderRadius: "8px", border: `1px solid ${theme.border}` }}
                />
                <Legend />
                <Bar dataKey="avg_cpu" name="Avg CPU %" fill="#8884d8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avg_gpu" name="Avg GPU %" fill="#82ca9d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* RECENT ACTIVITY */}
      <Paper sx={{
        p: 3,
        borderRadius: "16px",
        bgcolor: alpha(theme.paper, 0.4),
        border: `1px solid ${theme.border}`
      }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Recent Activity</Typography>
        <List>
          {data.recent_activity.map((item, index) => (
            <div key={item.id}>
              {index > 0 && <Divider sx={{ my: 1, borderColor: alpha(theme.border, 0.5) }} />}
              <ListItem
                disablePadding
                sx={{ py: 1.5, cursor: "pointer", "&:hover": { bgcolor: alpha(theme.primary, 0.05), borderRadius: "8px" } }}
                onClick={() => navigate(`/factories/${item.link_ids.factory_id}/algorithms/${item.link_ids.algo_id}/models/${item.link_ids.model_id}/versions/${item.link_ids.version_id}`)}
              >
                <ListItemIcon>
                  <Box sx={{
                    width: 40, height: 40,
                    borderRadius: "50%",
                    bgcolor: alpha(theme.primary, 0.1),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: theme.primary
                  }}>
                    <HistoryIcon fontSize="small" />
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography fontWeight={600} sx={{ color: theme.textMain }}>
                      New Version <span style={{ color: theme.primary }}>{item.version}</span> created for {item.model_name}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: theme.textMuted }}>
                      Algorithm: {item.algo_name} • {new Date(item.created_at).toLocaleString()}
                    </Typography>
                  }
                />
                <Button size="small" variant="text" sx={{ borderRadius: "20px" }}>View</Button>
              </ListItem>
            </div>
          ))}
          {data.recent_activity.length === 0 && (
            <Typography sx={{ color: theme.textMuted, fontStyle: "italic" }}>No recent activity.</Typography>
          )}
        </List>
      </Paper>

    </Box>
  );
}
