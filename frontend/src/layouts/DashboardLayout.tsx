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
  Menu,
  MenuItem,
  IconButton,
  Stack,
} from "@mui/material";

import StorageIconMui from "@mui/icons-material/Storage";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LogoutIcon from "@mui/icons-material/Logout";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuthStore } from "../app/authStore";
import { FactoriesDropdown } from "../components/NestedDropdownComponent";
import { useTheme } from "../theme/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import Chatbot from "../components/chat/Chatbot";

const DRAWER_WIDTH_EXPANDED = 320;
const DRAWER_WIDTH_COLLAPSED = 88;

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { user, logout } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSidebarToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const menuItems = [
    { label: "Dashboard", icon: <DashboardIcon />, path: "/dashboard" },
    { label: "Artifacts", icon: <StorageIconMui />, path: "/artifacts" },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        // Mesh Gradient Background for Premium Glass Effect
        background: `
                radial-gradient(circle at 0% 0%, ${alpha(theme.primary, 0.15)} 0%, transparent 40%),
                radial-gradient(circle at 100% 0%, ${alpha(theme.secondary, 0.15)} 0%, transparent 40%),
                radial-gradient(circle at 100% 100%, ${alpha(theme.primary, 0.1)} 0%, transparent 50%),
                radial-gradient(circle at 0% 100%, ${alpha(theme.secondary, 0.05)} 0%, transparent 50%),
                ${theme.background}
            `,
        backgroundAttachment: "fixed", // Keeps gradient static while scrolling
        overscrollBehavior: "none"
      }}
    >
      <CssBaseline />

      {/* TOP BAR - Glass Style */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: alpha(theme.paper, 0.8), // Glass effect compatible with dark mode
          backdropFilter: "blur(20px) saturate(180%)",
          color: theme.textMain,
          borderBottom: `1px solid ${alpha(theme.border, 0.6)}`,
          boxShadow: `0 4px 30px ${alpha(theme.textMain, 0.02)}`
        }}
        elevation={0}
      >
        <Toolbar sx={{ justifyContent: "space-between", px: { xs: 2, md: 4 } }}>
          {/* Logo / Brand */}
          {/* Logo / Brand */}
          <Box
            onClick={() => navigate("/")}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              cursor: "pointer",
              transition: "transform 0.4s ease-out",
              gap: 0,

              "&:hover .mars-text": {
                filter: `drop-shadow(0 0 12px ${alpha(theme.primary, 0.4)})`,
                letterSpacing: "0.01rem"
              }
            }}
          >
            <Typography
              className="mars-text"
              sx={{
                fontSize: "1.7rem",
                fontWeight: 800,
                letterSpacing: "0.01rem",
                background: `linear-gradient(135deg, ${theme.textMain} 0%, ${alpha(theme.textMain, 0.6)} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontFamily: "'Outfit', 'Inter', sans-serif",
                lineHeight: 0.9,
                textTransform: "uppercase",
                transition: "all 0.5s ease"
              }}
            >
              MARS
            </Typography>
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{
                fontSize: "0.6rem",
                letterSpacing: "0.05rem",
                color: theme.mode === 'light' ? alpha(theme.textMain, 0.6) : theme.textMuted,
                textTransform: "uppercase",
                opacity: 0.7,
                whiteSpace: 'nowrap',
                mt: 0.4,
                pl: 0.2 // Align visually with the M
              }}
            >
              Model Artifact & Repository System
            </Typography>
          </Box>



          {/* User Profile */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <ThemeToggle />

            <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>
                {user?.first_name} {user?.last_name}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.textMuted }}>
                {user?.email || "Engineer"}
              </Typography>
            </Box>

            <Avatar
              onClick={handleMenuOpen}
              sx={{
                width: 42, height: 42,
                bgcolor: alpha(theme.primary, 0.1),
                color: theme.primary,
                fontWeight: 800,
                border: `2px solid ${alpha(theme.border, 0.8)}`,
                cursor: "pointer",
                boxShadow: `0 4px 12px ${alpha(theme.primary, 0.15)}`,
                transition: "all 0.2s",
                "&:hover": {
                  bgcolor: theme.primary,
                  color: "#fff",
                  transform: "translateY(-1px)",
                  boxShadow: `0 6px 16px ${alpha(theme.primary, 0.25)}`
                }
              }}
            >
              {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
            </Avatar>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleMenuClose}
              PaperProps={{
                sx: {
                  mt: 1.5,
                  borderRadius: "16px",
                  border: `1px solid ${alpha(theme.border, 0.6)}`,
                  boxShadow: `0 20px 40px -10px ${alpha(theme.textMain, 0.15)}`,
                  backdropFilter: "blur(20px)",
                  bgcolor: alpha(theme.paper, 0.9)
                }
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={handleLogout} sx={{ fontWeight: 600, color: theme.textSecondary, m: 1, borderRadius: "8px" }}>
                <LogoutIcon sx={{ mr: 1.5, color: theme.error }} fontSize="small" />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* SIDEBAR - Light Glass Style */}
      <Drawer
        variant="permanent"
        sx={{
          width: isSidebarOpen ? DRAWER_WIDTH_EXPANDED : DRAWER_WIDTH_COLLAPSED,
          flexShrink: 0,
          whiteSpace: "nowrap",
          boxSizing: "border-box",
          [`& .MuiDrawer-paper`]: {
            width: isSidebarOpen ? DRAWER_WIDTH_EXPANDED : DRAWER_WIDTH_COLLAPSED,
            boxSizing: "border-box",
            backgroundColor: alpha(theme.paper, 0.6), // More transparent
            backdropFilter: "blur(20px) saturate(180%)",
            color: theme.textMain,
            borderRight: `1px solid ${alpha(theme.border, 0.6)}`,
            boxShadow: `4px 0 24px ${alpha(theme.textMain, 0.01)}`,
            overflowX: "hidden",
            transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <Toolbar />

        <Box sx={{ px: 2, py: 4, flexGrow: 1, overflowY: "auto", overflowX: "hidden" }}>
          <List>

            <FactoriesDropdown collapsed={!isSidebarOpen} />

            {menuItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);

              return (
                <ListItemButton
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  sx={{
                    mx: 1,
                    mb: 1,
                    borderRadius: "14px", // Pill shape
                    py: 1.5,
                    px: 1.5,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    backgroundColor: isActive ? alpha(theme.primary, 0.1) : "transparent",
                    color: isActive ? theme.primary : theme.textSecondary,
                    border: isActive ? `1px solid ${alpha(theme.primary, 0.1)}` : `1px solid transparent`,
                    "&:hover": {
                      backgroundColor: alpha(theme.primary, 0.05),
                      color: theme.primary,
                      transform: "translateX(4px)"
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 36,
                      color: "inherit", // Inherits form button color
                      transition: "all 0.2s"
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: "0.95rem",
                      fontWeight: isActive ? 800 : 600,
                    }}
                    sx={{ opacity: isSidebarOpen ? 1 : 0 }}
                  />
                  {isActive && (
                    <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: theme.primary, ml: 1, boxShadow: `0 0 8px ${theme.primary}` }} />
                  )}
                </ListItemButton>
              );
            })}
          </List>
        </Box>

        {/* Sidebar Footer Toggle */}
        <Box sx={{
          p: 2,
          display: "flex",
          justifyContent: isSidebarOpen ? "flex-end" : "center",
          borderTop: `1px solid ${alpha(theme.border, 0.4)}`,
          bgcolor: alpha(theme.paper, 0.4)
        }}>
          <Stack spacing={2} sx={{ width: '100%' }}>


            <Box sx={{ display: 'flex', justifyContent: isSidebarOpen ? 'flex-end' : 'center' }}>
              <IconButton onClick={handleSidebarToggle} sx={{ color: theme.textMuted, "&:hover": { color: theme.primary, bgcolor: alpha(theme.primary, 0.1) } }}>
                {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
              </IconButton>
            </Box>
          </Stack>
        </Box>
      </Drawer>

      {/* MAIN CONTENT AREA */}
      <Box component="main" sx={{ flexGrow: 1, p: 0 }}>
        <Toolbar />
        <Box sx={{ mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
      <Chatbot />
    </Box>
  );
}