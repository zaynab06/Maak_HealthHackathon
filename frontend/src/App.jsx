import { useCallback, useEffect, useRef, useState } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  HandHeart,
  HeartHandshake,
  Home,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { api, post } from "./api.js";
import {
  Brand,
  Button,
  Dialog,
  ErrorNotice,
  LanguageSwitch,
  Loading,
} from "./components.jsx";
import { useLanguage } from "./i18n.jsx";
import Login from "./Login.jsx";
import {
  CareView,
  CoordinatorHome,
  NeedDetail,
  NeedForm,
  NeedsView,
  ResidentHome,
} from "./NeedViews.jsx";
import {
  ActionForm,
  MinistryView,
  Opportunities,
  Pledges,
  ShelterView,
  Tasks,
} from "./Operations.jsx";

const nav = {
  resident: [
    ["home", Home],
    ["care", HeartHandshake],
    ["requests", ClipboardList],
  ],
  coordinator: [
    ["home", Home],
    ["needs", ClipboardList],
    ["deliveries", Truck],
    ["shelter", Boxes],
  ],
  donor: [
    ["opportunities", HandHeart],
    ["pledges", Package],
  ],
  volunteer: [
    ["tasks", ClipboardList],
    ["myTasks", Truck],
  ],
  ministry: [
    ["overview", ShieldCheck],
    ["shelters", Boxes],
    ["distribution", Package],
  ],
};
const sources = {
  resident: ["/needs"],
  coordinator: ["/needs", "/pledges", "/tasks", "/shelter"],
  donor: ["/opportunities", "/pledges"],
  volunteer: ["/tasks"],
  ministry: ["/overview"],
};

export default function App() {
  const [user, setUser] = useState(null);
  const [starting, setStarting] = useState(true);
  const [failure, setFailure] = useState("");
  const [expired, setExpired] = useState(false);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const boot = useCallback(async () => {
    setStarting(true);
    setFailure("");
    try {
      const result = await api("/session");
      setUser(result.user);
    } catch {
      setFailure("connectionError");
    } finally {
      setStarting(false);
    }
  }, []);
  useEffect(() => {
    boot();
  }, [boot]);
  useEffect(() => {
    const expire = () => {
      setUser(null);
      setExpired(true);
      navigate("/", { replace: true });
    };
    window.addEventListener("maak:session-expired", expire);
    return () => window.removeEventListener("maak:session-expired", expire);
  }, [navigate]);
  const onLogin = (value) => {
    setExpired(false);
    setUser(value);
    navigate("/" + nav[value.role][0][0]);
  };
  async function logout() {
    await post("/logout");
    setExpired(false);
    setUser(null);
    navigate("/");
  }
  if (starting) return <Loading />;
  if (failure)
    return (
      <div className="startup-error">
        <Brand />
        <ErrorNotice message={t(failure)} onRetry={boot} />
      </div>
    );
  if (!user) return <Login onLogin={onLogin} sessionExpired={expired} />;
  return <Workspace key={user.id} user={user} onLogout={logout} />;
}

function Workspace({ user, onLogout }) {
  const { t, error } = useLanguage();
  const latestError = useRef(error);
  latestError.current = error;
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  const closeModal = useCallback(() => setModal(null), []);
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const result = await Promise.all(
          sources[user.role].map((path) => api(path)),
        );
        if (live) {
          setData(result.reduce((all, obj) => ({ ...all, ...obj }), {}));
          setFailure("");
        }
      } catch (e) {
        if (live) setFailure(latestError.current(e));
      } finally {
        if (live) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 20000);
    return () => {
      live = false;
      clearInterval(interval);
    };
  }, [user.role, revision]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  const openNeed = (id) => setModal({ kind: "detail", id });
  const openRequest = (category) => setModal({ kind: "request", category });
  const openAction = (kind, entity) => setModal({ kind, entity });
  async function submitModal(body) {
    const kind = modal.kind;
    const path =
      kind === "request"
        ? "/needs"
        : kind === "pledge"
          ? "/pledges"
          : `/pledges/${modal.entity.id}/${kind === "task" ? "task" : "receive"}`;
    await post(path, body);
    closeModal();
    refresh();
    setToast({
      message: t(
        {
          request: "requestSaved",
          pledge: "pledgeSaved",
          task: "taskCreated",
          receipt: "receiptSaved",
        }[kind],
      ),
    });
  }
  async function taskAction(id, action) {
    setActionBusy(true);
    try {
      await post(`/tasks/${id}/${action}`);
      refresh();
      setToast({
        message: t(action === "accept" ? "taskAccepted" : "taskUpdated"),
      });
      if (action === "accept") navigate("/myTasks");
    } catch (e) {
      setToast({ message: error(e), error: true });
    } finally {
      setActionBusy(false);
    }
  }
  async function shelterUpdate(body) {
    await post("/shelter", body);
    refresh();
    setToast({ message: t("reportSaved") });
  }
  async function logout() {
    try {
      await onLogout();
    } catch (e) {
      setToast({ message: error(e), error: true });
    }
  }
  const render = (view) => {
    if (loading) return <Loading />;
    if (failure && !Object.keys(data).length)
      return <ErrorNotice message={failure} onRetry={refresh} />;
    if (user.role === "resident") {
      if (view === "home")
        return (
          <ResidentHome
            needs={data.needs || []}
            onRequest={openRequest}
            onOpen={openNeed}
            onViewRequests={() => navigate("/requests")}
          />
        );
      if (view === "care") return <CareView onRequest={openRequest} />;
      return (
        <NeedsView
          needs={data.needs || []}
          onOpen={openNeed}
          onRequest={openRequest}
        />
      );
    }
    if (user.role === "coordinator") {
      if (view === "home")
        return (
          <CoordinatorHome
            needs={data.needs || []}
            pledges={data.pledges || []}
            onOpen={openNeed}
            onView={() => navigate("/needs")}
          />
        );
      if (view === "needs")
        return (
          <NeedsView needs={data.needs || []} coordinator onOpen={openNeed} />
        );
      if (view === "deliveries")
        return (
          <Pledges
            pledges={data.pledges || []}
            coordinator
            onAction={openAction}
            onNeed={openNeed}
          />
        );
      return data.shelter ? (
        <ShelterView
          shelter={data.shelter}
          stock={data.stock || []}
          onSubmit={shelterUpdate}
        />
      ) : (
        <Loading />
      );
    }
    if (user.role === "donor")
      return view === "opportunities" ? (
        <Opportunities
          opportunities={data.opportunities || []}
          onPledge={(entity) => openAction("pledge", entity)}
        />
      ) : (
        <Pledges pledges={data.pledges || []} />
      );
    if (user.role === "volunteer")
      return (
        <Tasks
          tasks={data.tasks || []}
          user={user}
          onlyMine={view === "myTasks"}
          onAction={taskAction}
          busy={actionBusy}
        />
      );
    return data.metrics ? (
      <MinistryView overview={data} view={view} />
    ) : (
      <Loading />
    );
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("skip")}
      </a>
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-only"
            onClick={() => setMenu(false)}
            aria-label={t("close")}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span>{t("platform")}</span>
          <strong>{t(user.role)}</strong>
        </div>
        <nav aria-label={t("platform")}>
          {nav[user.role].map(([view, Icon]) => (
            <NavLink key={view} to={`/${view}`} onClick={() => setMenu(false)}>
              <Icon size={20} strokeWidth={1.7} />
              {t(view)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <HeartHandshake size={21} />
            <strong>{t("tagline")}</strong>
            <p>{t("yourNextAction")}</p>
          </div>
          <button className="logout-button" onClick={logout}>
            <LogOut size={18} />
            {t("signOut")}
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label={t("close")}
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button mobile-only"
              onClick={() => setMenu(true)}
              aria-label={t("platform")}
              aria-expanded={menu}
            >
              <Menu size={21} />
            </button>
            <div>
              <span>{t("platform")}</span>
              <strong>{t(user.role)}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <Button
              variant="quiet"
              onClick={refresh}
              title={t("refreshHint")}
              aria-label={t("refresh")}
            >
              <RefreshCw size={16} />
              <span className="desktop-only">{t("refresh")}</span>
            </Button>
            <LanguageSwitch />
            <div className="user-avatar" aria-hidden="true">
              {user.name[0]}
            </div>
            <span className="user-name">
              <bdi>{user.name}</bdi>
            </span>
          </div>
        </header>
        <main id="main-content">
          <div className="demo-banner">
            <span className="demo-dot" />
            <span>{t("demo")}</span>
            <span className="demo-banner-divider" />
            {t("demoNotice")}
          </div>
          {failure && Object.keys(data).length > 0 && (
            <ErrorNotice message={failure} onRetry={refresh} />
          )}
          <Routes>
            {nav[user.role].map(([view]) => (
              <Route path={`/${view}`} key={view} element={render(view)} />
            ))}
            <Route
              path="*"
              element={<Navigate to={`/${nav[user.role][0][0]}`} replace />}
            />
          </Routes>
          <footer className="app-footer">
            <span>
              Maak · <span lang="ar">معك</span>
            </span>
            <span>{t("tagline")}</span>
          </footer>
        </main>
      </div>
      {modal && (
        <Dialog
          title={t(
            {
              request: "requestHelp",
              detail: "requestDetails",
              pledge: "supportNeed",
              task: "createTask",
              receipt: "confirmShelterReceipt",
            }[modal.kind],
          )}
          onClose={closeModal}
        >
          {modal.kind === "request" ? (
            <NeedForm category={modal.category} onSubmit={submitModal} />
          ) : modal.kind === "detail" ? (
            <NeedDetail id={modal.id} user={user} onUpdated={refresh} />
          ) : (
            <ActionForm
              kind={modal.kind}
              entity={modal.entity}
              onSubmit={submitModal}
            />
          )}
        </Dialog>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.message}</span>
          <button
            className="icon-button"
            onClick={() => setToast(null)}
            aria-label={t("close")}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
