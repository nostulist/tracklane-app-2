import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";

const BG = "#0B0B0D";
const PANEL = "#17151A";
const BORDER = "#37333A";
const TEXT = "#EDE8DC";
const SUBTEXT = "#9C978A";
const MUTED_BG = "#211F24";
const ACCENT = "#9D3DFF";

const inputStyle = {
  padding: "0.65rem 0.9rem",
  borderRadius: "0.5rem",
  border: `1px solid ${BORDER}`,
  background: MUTED_BG,
  color: TEXT,
  width: "100%",
};

export default function Auth() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'error'|'info', text }

  const passwordTooShort = password.length > 0 && password.length < 8;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (passwordTooShort) return;
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({
          type: "info",
          text: "Проверь почту — мы отправили письмо для подтверждения регистрации. Войти можно после подтверждения.",
        });
      }
    } catch (err) {
      // Generic message on purpose: we don't reveal whether an email
      // exists in the system, which prevents account enumeration.
      setMessage({ type: "error", text: "Не удалось войти. Проверь email и пароль." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: `radial-gradient(circle at 1px 1px, rgba(237,232,220,0.05) 1px, transparent 0) 0 0/7px 7px, ${BG}`,
        minHeight: "100vh",
        color: TEXT,
        fontFamily: "'Manrope', sans-serif",
      }}
      className="w-full flex items-center justify-center px-4"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Special+Elite&family=Manrope:wght@400;500;700&display=swap');
        .display-font { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.03em; }
        .noir-font { font-family: 'Special Elite', 'Manrope', sans-serif; }
        input::placeholder { color: #6B7570; }
      `}</style>

      <div
        className="w-full max-w-sm rounded-sm p-6"
        style={{ backgroundColor: PANEL, border: "3px solid #000", boxShadow: `5px 5px 0 ${ACCENT}, 5px 5px 0 1px #000` }}
      >
        <h1 className="display-font text-4xl text-center mb-1">
          TRACK<span style={{ color: ACCENT }}>LANE</span>
        </h1>
        <p className="noir-font text-xs text-center mb-6" style={{ color: SUBTEXT }}>
          {mode === "signin" ? "Вход в личный кабинет" : "Создание аккаунта"}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg" style={{ ...inputStyle, padding: 0 }}>
            <Mail size={16} className="ml-3 shrink-0" style={{ color: SUBTEXT }} />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              style={{ background: "transparent", border: "none", outline: "none", color: TEXT, padding: "0.65rem 0.75rem", width: "100%" }}
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg" style={{ ...inputStyle, padding: 0 }}>
            <Lock size={16} className="ml-3 shrink-0" style={{ color: SUBTEXT }} />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль (мин. 8 символов)"
              style={{ background: "transparent", border: "none", outline: "none", color: TEXT, padding: "0.65rem 0.75rem", width: "100%" }}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="mr-3 shrink-0" style={{ color: SUBTEXT }}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {passwordTooShort && (
            <p className="text-xs" style={{ color: ACCENT }}>Пароль должен быть не короче 8 символов.</p>
          )}

          {message && (
            <p className="text-xs" style={{ color: message.type === "error" ? ACCENT : SUBTEXT }}>{message.text}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-2.5 rounded-lg font-semibold display-font text-lg tracking-wide"
            style={{ backgroundColor: ACCENT, color: "#F2EFE6", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "..." : mode === "signin" ? "ВОЙТИ" : "ЗАРЕГИСТРИРОВАТЬСЯ"}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); }}
          className="w-full text-center text-sm mt-4 noir-font"
          style={{ color: SUBTEXT }}
        >
          {mode === "signin" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}
