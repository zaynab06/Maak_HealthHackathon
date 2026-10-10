import { cloneElement, useEffect, useId, useRef } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  HeartHandshake,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useLanguage } from "./i18n.jsx";

export function Brand() {
  return (
    <div className="brand">
      <div className="brand-icon">
        <HeartHandshake size={25} strokeWidth={1.7} />
      </div>
      <div>
        <strong lang="ar" dir="rtl">
          معك
        </strong>
        <small>Maak</small>
      </div>
    </div>
  );
}
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <button
      className="language-button"
      onClick={() => setLanguage(language === "en" ? "ar" : "en")}
      type="button"
      aria-label={language === "en" ? "Switch to Arabic" : "Switch to English"}
    >
      {language === "en" ? "العربية" : "English"}
    </button>
  );
}
export function Button({
  children,
  variant = "",
  className = "",
  busy,
  ...props
}) {
  return (
    <button
      className={`button ${variant} ${className}`}
      {...props}
      disabled={props.disabled || busy}
    >
      {busy && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
export function Badge({ status }) {
  const { t } = useLanguage();
  const done = ["fulfilled", "received"].includes(status);
  const waiting = [
    "submitted",
    "coordinating",
    "distribution_pending",
    "awaiting_confirmation",
    "delivered",
    "pledged",
  ].includes(status);
  return (
    <span
      className={`badge ${done ? "success" : waiting ? "waiting" : "info"}`}
    >
      {done ? (
        <CheckCircle2 size={13} />
      ) : waiting ? (
        <Clock3 size={13} />
      ) : (
        <span className="badge-dot" />
      )}
      {status === "available" ? t("taskAvailable") : t(status)}
    </span>
  );
}
export function Empty({ icon: Icon = HeartHandshake, title, copy, children }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={27} strokeWidth={1.6} />
      </span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {children}
    </div>
  );
}
export function Metrics({ items }) {
  return (
    <div className="metrics">
      {items.map(({ value, label, icon: Icon }) => (
        <div className="metric" key={label}>
          <div className="metric-head">
            <span>{label}</span>
            {Icon && <Icon size={19} strokeWidth={1.6} />}
          </div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
export function Info({ title, children, warning = false }) {
  return (
    <div className={`info-box ${warning ? "warning" : ""}`}>
      <AlertCircle size={18} />
      <div>
        {title && <strong>{title}</strong>}
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}
export function Field({ label, hint, children }) {
  const generated = useId();
  const id = children.props.id || generated;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        "aria-describedby": hint ? `${id}-hint` : undefined,
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Dialog({ title, children, onClose }) {
  const ref = useRef();
  const { t } = useLanguage();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    const cancel = (e) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.close();
    };
  }, [onClose]);
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="dialog-title">
      <div className="dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <div className="dialog-header-actions">
          <LanguageSwitch />
          <button
            className="icon-button"
            onClick={onClose}
            type="button"
            aria-label={t("close")}
          >
            <X size={21} />
          </button>
        </div>
      </div>
      <div className="dialog-content">{children}</div>
    </dialog>
  );
}
export function Loading() {
  const { t } = useLanguage();
  return (
    <div className="loading">
      <LoaderCircle size={25} className="spin" />
      <p>{t("loading")}</p>
    </div>
  );
}
export function RequestCard({ need, onOpen, compact = false }) {
  const { t, date } = useLanguage();
  return (
    <article className={`card request-card ${compact ? "compact" : ""}`}>
      <div className="card-top">
        <span className="reference" dir="ltr">
          {need.reference}
        </span>
        <Badge status={need.status} />
      </div>
      <h3>{t(need.category)}</h3>
      {need.item && (
        <p className="item-copy">
          {t(need.item)}{" "}
          <span>
            · {need.quantity} {t(need.unit)}
          </span>
        </p>
      )}
      <p className="next-copy">{t(`next_${need.status}`)}</p>
      <div className="card-footer">
        <small>
          {t("reportFresh")} · {date(need.updated_at)}
        </small>
        <Button variant="secondary" onClick={() => onOpen(need.id)}>
          {t("viewRequest")}
          <ChevronRight className="directional" size={16} />
        </Button>
      </div>
    </article>
  );
}
export function ErrorNotice({ message, onRetry }) {
  const { t } = useLanguage();
  return (
    <div role="alert" className="error-notice">
      <AlertCircle size={20} />
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw size={16} />
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
