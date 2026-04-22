// client/src/pages/Login.jsx
import { useState } from "react";
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link, useLocation } from "react-router-dom";
import { loginUser, requestPasswordReset, resetPassword } from "../api";
import { Eye, EyeOff } from "lucide-react";
import logo from "../assets/logo.png";

export default function Login() {
  const [mode, setMode] = useState("login"); // login | request-reset | perform-reset
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password states
  const [discordUsername, setDiscordUsername] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const from = location.state?.from?.pathname || (username === "admin" ? "/" : "/student-dashboard");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginUser({ username, password });
      // accessToken is now returned as accessToken, not token
      login(data.accessToken, data.user);
      
      // Navigate to intended page or default based on role
      if (from === "/student-dashboard" || from === "/") {
          if (data.user.role === "student") {
            navigate("/student-dashboard");
          } else {
            navigate("/");
          }
      } else {
          navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await requestPasswordReset(discordUsername);
      setMessage(res.message);
      setMode("perform-reset");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const res = await resetPassword(
        discordUsername,
        verificationCode,
        newPassword,
      );
      setMessage(res.message);
      setTimeout(() => {
        setMode("login");
        setMessage("Now login with your new password");
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex-center"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "60vh",
        flexDirection: "column",
        textAlign: "center",
      }}
    >
      <div className="card" style={{ width: "400px" }}>
        <img
          src={logo}
          alt="Logo"
          style={{ height: "100px", marginBottom: "0rem" }}
        />
        {mode === "login" && (
          <form onSubmit={handleLogin}>
            <h2
              style={{
                textAlign: "center",
                marginBottom: "1.5rem",
                color: "var(--color-primary)",
              }}
            >
              Login
            </h2>
            {error && (
              <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>
            )}
            {message && (
              <div style={{ color: "green", marginBottom: "1rem" }}>
                {message}
              </div>
            )}

            <div className="input-group">
              <label>Username</label>
              <input
                className="input-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#888",
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <Link to="/register" style={{ color: "var(--color-primary)" }}>
                Need an account? Register
              </Link>
            </div>
            <div style={{ marginTop: "0.5rem", textAlign: "center" }}>
              <button
                type="button"
                className="btn-link"
                style={{
                  textDecoration: "underline",
                  background: "none",
                  border: "none",
                  color: "var(--color-primary)",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setMode("request-reset");
                  setError("");
                  setMessage("");
                }}
              >
                Forgot Password?
              </button>
            </div>
          </form>
        )}

        {mode === "request-reset" && (
          <form onSubmit={handleRequestReset}>
            <h2
              style={{
                textAlign: "center",
                marginBottom: "1.5rem",
                color: "var(--color-primary)",
              }}
            >
              Reset Password
            </h2>
            <p
              style={{
                textAlign: "center",
                fontSize: "0.9rem",
                marginBottom: "1.5rem",
                color: "#666",
              }}
            >
              Enter your Discord Username. We'll send you a verification code
              via DM.
            </p>
            {error && (
              <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>
            )}

            <div className="input-group">
              <label>Discord Username</label>
              <input
                className="input-control"
                placeholder="username or username#1234"
                value={discordUsername}
                onChange={(e) => setDiscordUsername(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={loading}
            >
              {loading ? "Sending Code..." : "Send Verification Code"}
            </button>

            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <button
                type="button"
                className="btn-link"
                onClick={() => setMode("login")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-primary)",
                  cursor: "pointer",
                }}
              >
                Back to Login
              </button>
            </div>
          </form>
        )}

        {mode === "perform-reset" && (
          <form onSubmit={handleResetPassword}>
            <h2
              style={{
                textAlign: "center",
                marginBottom: "1.5rem",
                color: "var(--color-primary)",
              }}
            >
              New Password
            </h2>
            {message && (
              <div style={{ color: "green", marginBottom: "1rem" }}>
                {message}
              </div>
            )}
            {error && (
              <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>
            )}

            <div className="input-group">
              <label>Verification Code</label>
              <input
                className="input-control"
                placeholder="6-digit code from Discord"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="input-group">
              <label>New Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showNewPassword ? "text" : "password"}
                  className="input-control"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#888",
                  }}
                >
                  {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label>Confirm New Password</label>
              <input
                type={showNewPassword ? "text" : "password"}
                className="input-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={loading}
            >
              {loading ? "Updating..." : "Change Password"}
            </button>

            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <button
                type="button"
                className="btn-link"
                onClick={() => setMode("request-reset")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-primary)",
                  cursor: "pointer",
                }}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

