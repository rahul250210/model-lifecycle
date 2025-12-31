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
  Avatar,
  alpha,
  Tooltip,
} from "@mui/material";
import FactoryIcon from "@mui/icons-material/Factory";
import ScienceIcon from "@mui/icons-material/Science";
import LayersIcon from "@mui/icons-material/Layers";
import TimelineIcon from "@mui/icons-material/Timeline";
import StorageIcon from "@mui/icons-material/Storage";
import { useNavigate, useLocation, Outlet } from "react-router-dom";

const drawerWidth = 280;

/* ==========================================================================
   GLOBAL COLOR PALETTE (Use these hex codes across other pages for consistency)
   ========================================================================== */
export const themePalette = {
  primary: "#4F46E5",       // Indigo (Brand Color)
  primaryLight: "#EEF2FF",  // Soft Indigo Wash
  sidebarBg: "#0F172A",     // Deep Navy/Slate (Dark Mode Sidebar)
  sidebarActive: "#1E293B", // Lighter Slate for active items
  textMuted: "#94A3B8",     // Slate Gray for inactive text
  background: "#F8FAFC",    // Clean White-Gray page background
  border: "#E2E8F0",        // Light subtle borders
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { label: "Factories", icon: <FactoryIcon />, path: "/factories" },
    { label: "Models", icon: <LayersIcon />, path: "/factories" },
    { label: "Versions", icon: <TimelineIcon />, path: "/factories" },
    { label: "Experiments", icon: <ScienceIcon />, path: "/factories" },
    { label: "Artifacts", icon: <StorageIcon />, path: "/factories" },
  ];

  return (
    <Box sx={{ display: "flex", bgcolor: themePalette.background, minHeight: "100vh" }}>
      <CssBaseline />

      {/* =======================
          Top App Bar
      ======================= */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: alpha("#ffffff", 0.9),
          backdropFilter: "blur(12px)",
          color: "#1E293B",
          borderBottom: `1px solid ${themePalette.border}`,
        }}
        elevation={0}
      >
        <Toolbar sx={{ justifyContent: "space-between", px: 4 }}>
          <Typography 
            variant="h6" 
            fontWeight={800} 
            sx={{ 
              letterSpacing: "-0.02em",
              background: `linear-gradient(45deg, ${themePalette.primary}, #818CF8)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}
          >
            MLOps Platform
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
             <Typography variant="body2" sx={{ color: themePalette.textMuted, fontWeight: 500 }}>
              System Status: <Box component="span" sx={{ color: "#10B981" }}>● Online</Box>
            </Typography>
            <Avatar 
              sx={{ 
                width: 36, 
                height: 36, 
                bgcolor: themePalette.primary,
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${alpha(themePalette.primary, 0.1)}`
              }}
            >
              JD
            </Avatar>
          </Box>
        </Toolbar>
      </AppBar>

      {/* =======================
          Sidebar (Dark Theme)
      ======================= */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: themePalette.sidebarBg,
            color: "#fff",
            borderRight: "none",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ px: 2, py: 4 }}>
          <List>
            {menuItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <ListItemButton
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  sx={{
                    mx: 1,
                    mb: 1,
                    borderRadius: "10px",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    backgroundColor: isActive ? alpha(themePalette.primary, 0.15) : "transparent",
                    borderLeft: isActive ? `3px solid ${themePalette.primary}` : "3px solid transparent",
                    "&:hover": {
                      backgroundColor: alpha(themePalette.primary, 0.1),
                      transform: "translateX(4px)",
                    },
                  }}
                >
                  <ListItemIcon 
                    sx={{ 
                      minWidth: 42, 
                      color: isActive ? themePalette.primary : themePalette.textMuted,
                      transition: "color 0.3s"
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.label} 
                    primaryTypographyProps={{ 
                      fontSize: "0.925rem", 
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? "#fff" : themePalette.textMuted
                    }} 
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Drawer>

      {/* =======================
          Main Content
      ======================= */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 5,
          transition: "padding 0.3s ease",
        }}
      >
        <Toolbar />
        <Box 
          sx={{ 
            maxWidth: "1400px", 
            mx: "auto",
            animation: "fadeInUp 0.6s ease-out",
            "@keyframes fadeInUp": {
              "0%": { opacity: 0, transform: "translateY(20px)" },
              "100%": { opacity: 1, transform: "translateY(0)" }
            }
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}