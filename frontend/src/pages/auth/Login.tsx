import { useState } from "react";
import {
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link as MuiLink,
  Paper,
  InputAdornment,
  IconButton,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  EmailOutlined,
  LockOutlined,
} from "@mui/icons-material";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../../app/authStore";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await login(email, password);
      navigate("/factories");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed. Please try again.");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 2% 10%, rgba(79, 70, 229, 0.05) 0%, transparent 20%), radial-gradient(circle at 95% 90%, rgba(79, 70, 229, 0.08) 0%, transparent 20%), #f8fafc",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative Blur Blobs */}
      <Box sx={{ position: "absolute", top: "10%", left: "15%", width: 300, height: 300, background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", filter: "blur(100px)", opacity: 0.1, zIndex: 0 }} />
      
      <Container maxWidth="sm" sx={{ zIndex: 1 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 6 },
            borderRadius: 4,
            border: "1px solid",
            borderColor: "rgba(226, 232, 240, 0.8)",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            background: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Box sx={{ mb: 4, textAlign: "center" }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 48,
                height: 48,
                borderRadius: 1.5,
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                color: "white",
                mb: 2,
                boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.4)",
              }}
            >
              <LockOutlined />
            </Box>
            <Typography
              variant="h4"
              sx={{ fontWeight: 800, color: "#1e293b", letterSpacing: "-0.025em", mb: 1 }}
            >
              Welcome back
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 500 }}>
              Please enter your details to sign in
            </Typography>
          </Box>

          {error && (
            <Alert 
              severity="error" 
              variant="outlined"
              sx={{ mb: 3, borderRadius: 2, border: "1px solid #fee2e2", backgroundColor: "#fef2f2" }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 1, display: "block", ml: 0.5 }}>
                EMAIL ADDRESS
              </Typography>
              <TextField
                fullWidth
                placeholder="name@company.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlined sx={{ fontSize: 20, color: "#94a3b8" }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2.5,
                    backgroundColor: "#fcfcfd",
                    transition: "all 0.2s",
                    "&:hover": { backgroundColor: "#fff" },
                    "&.Mui-focused": { backgroundColor: "#fff", boxShadow: "0 0 0 4px rgba(79, 70, 229, 0.1)" },
                  },
                }}
              />
            </Box>

            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 1, display: "block", ml: 0.5 }}>
                PASSWORD
              </Typography>
              <TextField
                fullWidth
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ fontSize: 20, color: "#94a3b8" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff sx={{ fontSize: 20 }} /> : <Visibility sx={{ fontSize: 20 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2.5,
                    backgroundColor: "#fcfcfd",
                    transition: "all 0.2s",
                    "&.Mui-focused": { backgroundColor: "#fff", boxShadow: "0 0 0 4px rgba(79, 70, 229, 0.1)" },
                  },
                }}
              />
            </Box>

            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 3 }}>
              <MuiLink
                component={Link}
                to="/forgot-password"
                sx={{ fontSize: "0.85rem", color: "#4F46E5", fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                Forgot password?
              </MuiLink>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{
                py: 1.8,
                borderRadius: 2.5,
                backgroundColor: "#4F46E5",
                fontSize: "0.95rem",
                fontWeight: 600,
                textTransform: "none",
                boxShadow: "0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1)",
                transition: "all 0.2s",
                "&:hover": {
                  backgroundColor: "#4338CA",
                  boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.3)",
                  transform: "translateY(-1px)",
                },
                "&:active": { transform: "translateY(0)" },
              }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : "Sign in to account"}
            </Button>
          </form>

          <Box sx={{ textAlign: "center", mt: 4 }}>
            <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 500 }}>
              New here?{" "}
              <MuiLink
                component={Link}
                to="/signup"
                sx={{
                  color: "#4F46E5",
                  textDecoration: "none",
                  fontWeight: 700,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Create an account
              </MuiLink>
            </Typography>
          </Box>
        </Paper>
        
        <Typography variant="body2" sx={{ textAlign: "center", mt: 4, color: "#94a3b8", fontWeight: 500 }}>
          © 2026 Model Lifecycle. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
};

export default Login;