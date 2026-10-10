import { useEffect, useState } from "react";
import {
  ArrowRight,
  Boxes,
  HeartHandshake,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { api, post } from "./api.js";
import {
  Brand,
  Button,
  ErrorNotice,
  Field,
  Info,
  LanguageSwitch,
} from "./components.jsx";
import { useLanguage } from "./i18n.jsx";

const roles = [
  { role: "resident", icon: UserRound },
  { role: "coordinator", icon: Boxes },
  { role: "donor", icon: HeartHandshake },
  { role: "volunteer", icon: Truck },
  { role: "ministry", icon: ShieldCheck },
];

export default function Login({ onLogin, sessionExpired }) {
  const { t, error } = useLanguage();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("resident");
  const [shelters, setShelters] = useState([]);
  const [shelter, setShelter] = useState("");
  const [selectedDemo, setSelectedDemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    let live = true;
    api("/shelters")
      .then((data) => {
        if (live) {
          setShelters(data.shelters);
          setShelter(data.shelters[0]?.id || "");
        }
      })
      .catch((e) => {
        if (live) setFailure(error(e));
      });
    return () => {
      live = false;
    };
  }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    try {
      const data = await post(register ? "/register" : "/login", {
        email,
        password,
        ...(register ? { name, role, shelter_id: shelter } : {}),
      });
      onLogin(data.user);
    } catch (e) {
      setFailure(error(e));
    } finally {
      setBusy(false);
    }
  }
  function choose(role) {
    setRegister(false);
    setSelectedDemo(role);
    setEmail(`${role}@maak.demo`);
    setPassword("MaakDemo!2026");
    setFailure("");
    document.getElementById("login-email")?.focus();
  }
  return (
    <div className="login-page">
      <header className="login-header">
        <Brand />
        <LanguageSwitch />
      </header>
      <div className="login-grid">
        <section className="login-story">
          <p className="eyebrow">{t("tagline")}</p>
          <h1>
            {t("welcomeTitle")
              .split("\n")
              .map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
          </h1>
          <p className="login-lead">{t("welcomeCopy")}</p>
          <div className="logo-surface">
            <img
              src="/maak-logo.png"
              alt="Maak / معك — cedar, protective hands, and heart"
            />
          </div>
          <div className="story-points">
            <span>
              <CheckMark />
              {t("yourNextAction")}
            </span>
            <span>
              <CheckMark />
              {t("privacyTitle")}
            </span>
          </div>
        </section>
        <section className="login-panel">
          <div className="login-panel-heading">
            <span className="eyebrow green">{t("platform")}</span>
            <h2>{register ? t("register") : t("signIn")}</h2>
          </div>
          {sessionExpired && <Info warning>{t("sessionExpired")}</Info>}
          <form onSubmit={submit} className="form-stack">
            {failure && <ErrorNotice message={failure} />}
            {register && (
              <Field label={t("name")}>
                <input
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                />
              </Field>
            )}
            <Field label={t("email")}>
              <input
                id="login-email"
                name="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
              />
            </Field>
            <Field
              label={t("password")}
              hint={register ? t("passwordHint") : undefined}
            >
              <input
                name="password"
                type="password"
                dir="ltr"
                autoComplete={register ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={register ? 10 : undefined}
                maxLength={128}
              />
            </Field>
            {register && (
              <>
                <Field label={t("role")}>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {["resident", "donor", "volunteer"].map((r) => (
                      <option value={r} key={r}>
                        {t(r)}
                      </option>
                    ))}
                  </select>
                </Field>
                {role === "resident" && (
                  <Field label={t("shelterName")}>
                    <select
                      value={shelter}
                      onChange={(e) => setShelter(e.target.value)}
                      required
                    >
                      {shelters.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {role === "volunteer" && (
                  <p className="small-text">{t("pendingVolunteer")}</p>
                )}
              </>
            )}
            {selectedDemo && !register && (
              <p className="demo-selected">
                {t("demoFilled")} <strong>{t(selectedDemo)}</strong>
              </p>
            )}
            <Button type="submit" className="full-width" busy={busy}>
              {register ? t("register") : t("signIn")}
              <ArrowRight size={17} className="directional" />
            </Button>
          </form>
          <p className="auth-switch">
            {register ? t("haveAccount") : t("newAccount")}{" "}
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setRegister(!register);
                setFailure("");
                setSelectedDemo("");
              }}
            >
              {register ? t("signIn") : t("register")}
            </button>
          </p>
          <div className="demo-workspaces">
            <h3>{t("chooseDemo")}</h3>
            <div className="demo-role-grid">
              {roles.map(({ role, icon: Icon }) => (
                <button
                  type="button"
                  key={role}
                  className={`demo-role ${selectedDemo === role ? "selected" : ""}`}
                  onClick={() => choose(role)}
                  aria-label={`${t("useDemo")}: ${t(role)}`}
                >
                  <Icon size={20} strokeWidth={1.7} />
                  <span>{t(role)}</span>
                </button>
              ))}
            </div>
            <p>{t("demoCredentials")}</p>
          </div>
        </section>
      </div>
      <footer className="login-footer">
        <span>{t("demo")}</span>
        <span>{t("demoNotice")}</span>
      </footer>
    </div>
  );
}
function CheckMark() {
  return (
    <span className="check-mark" aria-hidden="true">
      ✓
    </span>
  );
}
