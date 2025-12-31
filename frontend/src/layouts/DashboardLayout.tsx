"use client";

import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  AppBar,
  Typography,
  CssBaseline,
} from "@mui/material";
import FactoryIcon from "@mui/icons-material/Factory";
import ScienceIcon from "@mui/icons-material/Science";
import LayersIcon from "@mui/icons-material/Layers";
import TimelineIcon from "@mui/icons-material/Timeline";
import StorageIcon from "@mui/icons-material/Storage";
import { useNavigate, useLocation, Outlet } from "react-router-dom";

const drawerWidth = 260;

/* =======================
   Component
======================= */

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      label: "Factories",
      icon: <FactoryIcon />,
      path: "/factories",
    },
    {
      label: "Models",
      icon: <LayersIcon />,
      path: "/factories", // entry via factories
    },
    {
      label: "Versions",
      icon: <TimelineIcon />,
      path: "/factories",
    },
    {
      label: "Experiments",
      icon: <ScienceIcon />,
      path: "/factories",
    },
    {
      label: "Artifacts",
      icon: <StorageIcon />,
      path: "/factories",
    },
  ];

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      {/* =======================
          Top App Bar
      ======================= */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: "background.paper",
          color: "text.primary",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
        elevation={0}
      >
        <Toolbar>
          <Typography variant="h6" fontWeight={700}>
            MLOps Platform
          </Typography>
        </Toolbar>
      </AppBar>

      {/* =======================
          Sidebar
      ======================= */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        <Toolbar />

        <List>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.label}
              selected={location.pathname.startsWith(item.path)}
              onClick={() => navigate(item.path)}
              sx={{
                mx: 1,
                my: 0.5,
                borderRadius: 2,
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      {/* =======================
          Main Content
      ======================= */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          backgroundColor: "background.default",
          minHeight: "100vh",
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
