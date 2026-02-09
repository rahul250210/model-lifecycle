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

import StorageIcon from "@mui/icons-material/Storage";
import LogoutIcon from "@mui/icons-material/Logout";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuthStore } from "../app/authStore";
import { FactoriesDropdown } from "../components/NestedDropdownComponent";
import { useTheme } from "../theme/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";

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
    { label: "Artifacts", icon: <StorageIcon />, path: "/artifacts" },
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
              alignItems: 'center',
              gap: 1.5,
              cursor: "pointer",
              "&:hover .brand-icon": { transform: "rotate(180deg) scale(1.1)" },
              "&:hover .brand-text": { transform: "scale(1.02)" }
            }}
          >
            <Box
              className="brand-icon"
              sx={{
                width: 40,
                height: 40,
                borderRadius: "12px",
                background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 8px 16px ${alpha(theme.primary, 0.25)}`,
                transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
            >
              <Typography variant="h5" sx={{ color: "white", fontWeight: "bold" }}>N</Typography>
            </Box>
            <Typography
              className="brand-text"
              variant="h5"
              fontWeight={800}
              sx={{
                letterSpacing: "-0.02em",
                background: `linear-gradient(to right, ${theme.textMain} 30%, ${theme.primary} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                transition: "transform 0.3s",
                fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", // Fallback to safe fonts
              }}
            >
              NexusForge
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
    </Box>
  );
}