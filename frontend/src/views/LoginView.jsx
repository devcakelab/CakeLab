const LOGIN_BRAND_IMAGE = `${window.location.origin}/clheader.png`;

export default function LoginView({
  authMode,
  setAuthMode,
  busy,
  loginForm,
  setLoginForm,
  registerForm,
  setRegisterForm,
  resetForm,
  setResetForm,
  onLogin,
  onRegister,
  onResetPassword,
}) {
  const pageTitle =
    authMode === "login" ? "Welcome!" : authMode === "register" ? "Create account" : "Reset password";

  return (
    <main className="login-page">
      <div className="login-glow login-glow-left" aria-hidden="true" />
      <div className="login-glow login-glow-right" aria-hidden="true" />
      <div className="login-layout">
        <section className="login-card login-card-glass" aria-labelledby="login-title">
          <h1 id="login-title" className="login-title">
            {pageTitle}
          </h1>
          {authMode === "login" ? (
            <form onSubmit={onLogin} className="login-form" aria-label="Login form" autoComplete="off">
              <label className="login-field">
                <span>Username</span>
                <input
                  className="login-input"
                  placeholder="Enter Your Username Here"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm((s) => ({ ...s, username: e.target.value }))}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="login-field">
                <span>Password</span>
                <input
                  className="login-input"
                  type="password"
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((s) => ({ ...s, password: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
              </label>

              <div className="login-meta-row">
                <label className="login-check">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <button type="button" className="login-link-btn" onClick={() => setAuthMode("reset")}>
                  Forgot password
                </button>
              </div>

              <button className="login-submit" disabled={busy}>
                {busy ? "Signing in..." : "Log in"}
              </button>

              <p className="login-footer">
                Don't have an account?{" "}
                <button type="button" className="login-link-btn" onClick={() => setAuthMode("register")}>
                  Register
                </button>
              </p>
            </form>
          ) : null}

          {authMode === "register" ? (
            <form onSubmit={onRegister} className="login-form" aria-label="Register form">
              <label className="login-field">
                <span>Full name</span>
                <input
                  className="login-input"
                  value={registerForm.fullName}
                  onChange={(e) => setRegisterForm((s) => ({ ...s, fullName: e.target.value }))}
                  required
                />
              </label>
              <label className="login-field">
                <span>Username</span>
                <input
                  className="login-input"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm((s) => ({ ...s, username: e.target.value }))}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="login-field">
                <span>Password</span>
                <input
                  className="login-input"
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm((s) => ({ ...s, password: e.target.value }))}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>
              <label className="login-field">
                <span>Confirm password</span>
                <input
                  className="login-input"
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>
              <button className="login-submit" disabled={busy}>
                {busy ? "Creating..." : "Create account"}
              </button>
              <p className="login-footer">
                Already have an account?{" "}
                <button type="button" className="login-link-btn" onClick={() => setAuthMode("login")}>
                  Log in
                </button>
              </p>
            </form>
          ) : null}

          {authMode === "reset" ? (
            <form onSubmit={onResetPassword} className="login-form" aria-label="Reset password form">
              <label className="login-field">
                <span>Username</span>
                <input
                  className="login-input"
                  value={resetForm.username}
                  onChange={(e) => setResetForm((s) => ({ ...s, username: e.target.value }))}
                  required
                />
              </label>
              <label className="login-field">
                <span>New password</span>
                <input
                  className="login-input"
                  type="password"
                  value={resetForm.newPassword}
                  onChange={(e) => setResetForm((s) => ({ ...s, newPassword: e.target.value }))}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>
              <label className="login-field">
                <span>Confirm new password</span>
                <input
                  className="login-input"
                  type="password"
                  value={resetForm.confirmPassword}
                  onChange={(e) => setResetForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>
              <button className="login-submit" disabled={busy}>
                {busy ? "Resetting..." : "Reset password"}
              </button>
              <p className="login-footer">
                Remember your password?{" "}
                <button type="button" className="login-link-btn" onClick={() => setAuthMode("login")}>
                  Back to login
                </button>
              </p>
            </form>
          ) : null}
        </section>

        <aside className="login-brand-panel" aria-hidden="true">
          <img src={LOGIN_BRAND_IMAGE} alt="CakeLab logo" className="login-brand-image" />
          <p className="login-brand-tagline">Crafted for smooth orders, fast checkout, and daily insights.</p>
        </aside>
      </div>
    </main>
  );
}
