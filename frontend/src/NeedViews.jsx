import { useEffect, useRef, useState } from "react";
import {
  Baby,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Droplets,
  HeartHandshake,
  Package,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Truck,
  Zap,
} from "lucide-react";
import { api, commandId, post } from "./api.js";
import {
  Badge,
  Button,
  Empty,
  ErrorNotice,
  Field,
  Info,
  Loading,
  Metrics,
  RequestCard,
} from "./components.jsx";
import { useLanguage } from "./i18n.jsx";

const categories = [
  { key: "essentials", icon: Package },
  { key: "oxygen", icon: HeartHandshake },
  { key: "power", icon: Zap },
];
const planned = [
  { key: "dialysis", icon: Droplets },
  { key: "pregnancy", icon: Baby },
  { key: "mobility", icon: Truck },
  { key: "mental", icon: Stethoscope },
];
export function CategoryCards({ onChoose }) {
  const { t } = useLanguage();
  return (
    <div className="category-grid">
      {categories.map(({ key, icon: Icon }) => (
        <button
          type="button"
          className="category-card"
          key={key}
          onClick={() => onChoose(key)}
        >
          <span className="icon-tile">
            <Icon size={24} strokeWidth={1.7} />
          </span>
          <strong>{t(key)}</strong>
          <small>{t(`${key}Desc`)}</small>
        </button>
      ))}
    </div>
  );
}

export function ResidentHome({ needs, onRequest, onOpen, onViewRequests }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="page-heading">
        <h1>{t("greeting")}</h1>
        <p>{t("greetingSub")}</p>
      </div>
      <div className="hero">
        <div>
          <p className="eyebrow">{t("tagline")}</p>
          <h2>
            {t("welcomeTitle")
              .split("\n")
              .map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
          </h2>
          <p>{t("welcomeCopy")}</p>
          <Button variant="light" onClick={() => onRequest("essentials")}>
            <Package size={17} />
            {t("requestHelp")}
          </Button>
        </div>
        <div className="hero-logo">
          <img src="/maak-logo.png" alt="Maak / معك" />
        </div>
      </div>
      <Metrics
        items={[
          {
            value: needs.filter((n) => n.status !== "fulfilled").length,
            label: t("openRequests"),
            icon: ClipboardList,
          },
          {
            value: needs.filter((n) => n.status === "awaiting_confirmation")
              .length,
            label: t("awaitingMe"),
            icon: CheckCircle2,
          },
          {
            value: needs.filter((n) => n.status === "fulfilled").length,
            label: t("confirmedNeeds"),
            icon: ShieldCheck,
          },
        ]}
      />
      <div className="section-heading">
        <h2>{t("whatNeed")}</h2>
      </div>
      <CategoryCards onChoose={onRequest} />
      <div className="section-heading">
        <h2>{t("latestRequests")}</h2>
        <button className="text-button" onClick={onViewRequests}>
          {t("allRequests")}
        </button>
      </div>
      {needs.length ? (
        <div className="request-grid">
          {needs.slice(0, 2).map((n) => (
            <RequestCard key={n.id} need={n} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <Empty title={t("noRequests")} copy={t("noRequestsCopy")}>
          <Button onClick={() => onRequest("essentials")}>
            {t("requestHelp")}
          </Button>
        </Empty>
      )}
      <div className="bottom-notes">
        <Info title={t("savedHonest")}>{t("savedHonestCopy")}</Info>
        <Info title={t("privacyTitle")}>{t("privacyCopy")}</Info>
      </div>
    </>
  );
}

export function CareView({ onRequest }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="page-heading">
        <h1>{t("careTitle")}</h1>
        <p>{t("careSub")}</p>
      </div>
      <CategoryCards onChoose={onRequest} />
      <div className="section-heading">
        <h2>{t("plannedServices")}</h2>
      </div>
      <div className="planned-grid">
        {planned.map(({ key, icon: Icon }) => (
          <div className="planned-card" key={key}>
            <Icon size={21} />
            <strong>{t(key)}</strong>
            <span>{t("planned")}</span>
          </div>
        ))}
      </div>
      <Info title={t("savedHonest")}>{t("urgentNote")}</Info>
    </>
  );
}

export function NeedsView({ needs, coordinator, onOpen, onRequest }) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState("all");
  const visible = needs.filter(
    (n) =>
      filter === "all" ||
      (filter === "open" && n.status !== "fulfilled") ||
      (filter === "review" && !n.reviewed) ||
      (filter === "fulfilled" && n.status === "fulfilled"),
  );
  return (
    <>
      <div className="page-heading heading-with-action">
        <div>
          <h1>{coordinator ? t("reviewQueue") : t("requests")}</h1>
          <p>{coordinator ? t("coordinatorSub") : t("greetingSub")}</p>
        </div>
        {!coordinator && (
          <Button onClick={() => onRequest("essentials")}>
            {t("requestHelp")}
          </Button>
        )}
      </div>
      <div className="filter-row">
        <select
          aria-label={t("status")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">{t("allRequests")}</option>
          <option value="open">{t("openRequests")}</option>
          {coordinator && <option value="review">{t("needsReview")}</option>}
          <option value="fulfilled">{t("confirmedNeeds")}</option>
        </select>
        <span className="small-text">
          {visible.length} / {needs.length}
        </span>
      </div>
      {visible.length ? (
        <div className="request-grid">
          {visible.map((n) => (
            <RequestCard key={n.id} need={n} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <Empty
          icon={ClipboardList}
          title={t(coordinator ? "noNeeds" : "noRequests")}
          copy={t(coordinator ? "noNeedsCopy" : "noRequestsCopy")}
        />
      )}
    </>
  );
}

export function NeedForm({ category: initial, onSubmit }) {
  const { t, error } = useLanguage();
  const key = useRef(commandId());
  const [category, setCategory] = useState(initial || "essentials");
  const [item, setItem] = useState("hygiene_kits");
  const [quantity, setQuantity] = useState(1);
  const [device, setDevice] = useState("unknown");
  const [otherDevice, setOtherDevice] = useState("");
  const [power, setPower] = useState("unknown");
  const [remaining, setRemaining] = useState("");
  const [backup, setBackup] = useState("");
  const [note, setNote] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const units = {
    hygiene_kits: "kits",
    blankets: "items",
    baby_wipes: "packs",
    food_packages: "packs",
  };
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    try {
      await onSubmit({
        command_id: key.current,
        category,
        private_note: note,
        reported_urgent: urgent,
        ...(category === "essentials"
          ? { item, quantity: Number(quantity) }
          : {
              device_type: device,
              other_device: otherDevice,
              power_status: power,
              remaining_supply: remaining,
              backup,
            }),
      });
    } catch (e) {
      setFailure(error(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      {failure && <ErrorNotice message={failure} />}
      <Field label={t("chooseCategory")}>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {t(c.key)}
            </option>
          ))}
        </select>
      </Field>
      {category === "essentials" ? (
        <>
          <Field label={t("item")}>
            <select value={item} onChange={(e) => setItem(e.target.value)}>
              {Object.keys(units).map((i) => (
                <option value={i} key={i}>
                  {t(i)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`${t("quantity")} (${t(units[item])})`}>
            <input
              type="number"
              value={quantity}
              min={1}
              max={10000}
              step={1}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </Field>
        </>
      ) : (
        <>
          <Field label={t("deviceType")}>
            <select value={device} onChange={(e) => setDevice(e.target.value)}>
              {[
                "unknown",
                "oxygen_cylinder",
                "oxygen_concentrator",
                "ventilator",
                "suction_device",
                "feeding_device",
                "other",
              ].map((d) => (
                <option key={d} value={d}>
                  {t(d)}
                </option>
              ))}
            </select>
          </Field>
          {device === "other" && (
            <Field label={t("otherDevice")}>
              <input
                value={otherDevice}
                onChange={(e) => setOtherDevice(e.target.value)}
                maxLength={100}
                required
              />
            </Field>
          )}
          <Field label={t("powerStatus")}>
            <select value={power} onChange={(e) => setPower(e.target.value)}>
              {["unknown", "available", "unavailable"].map((p) => (
                <option key={p} value={p}>
                  {t(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("remainingSupply")} hint={t("remainingHint")}>
            <input
              value={remaining}
              onChange={(e) => setRemaining(e.target.value)}
              maxLength={100}
              placeholder={t("unknown")}
            />
          </Field>
          <Field label={t("backup")} hint={t("backupHint")}>
            <input
              value={backup}
              onChange={(e) => setBackup(e.target.value)}
              maxLength={100}
              placeholder={t("unknown")}
            />
          </Field>
        </>
      )}
      <Field
        label={`${t("privateNote")} (${t("optional")})`}
        hint={t("privateNoteHint")}
      >
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
        />
      </Field>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={urgent}
          onChange={(e) => setUrgent(e.target.checked)}
        />
        <span>{t("reportedUrgent")}</span>
      </label>
      {(urgent || category !== "essentials") && (
        <Info warning>{t("urgentNote")}</Info>
      )}
      <Button type="submit" busy={busy} className="full-width">
        {t("saveRequest")}
      </Button>
    </form>
  );
}

export function NeedDetail({ id, user, onUpdated }) {
  const { t, date, error } = useLanguage();
  const [need, setNeed] = useState(null);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState(null);
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [success, setSuccess] = useState("");
  const latestError = useRef(error);
  latestError.current = error;
  useEffect(() => {
    let live = true;
    const load = () =>
      api(`/needs/${id}`)
        .then((data) => {
          if (live)
            setNeed((previous) =>
              !previous || data.need.updated_at >= previous.updated_at
                ? data.need
                : previous,
            );
        })
        .catch((e) => {
          if (live) setFailure(latestError.current(e));
        });
    load();
    const timer = setInterval(load, 20000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [id]);
  async function refreshDetail() {
    try {
      const data = await api(`/needs/${id}`);
      setNeed(data.need);
      setFailure("");
    } catch (e) {
      setFailure(error(e));
    }
  }
  function chooseAction(name) {
    setAction({ name, command_id: commandId() });
    setSuccess("");
    setFailure("");
    setNote(t(name === "review" ? "reviewDefault" : "publishDefault"));
    setQuantity(
      name === "distribute"
        ? need.received - need.distributed
        : need.distributed - need.confirmed,
    );
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    const name = action.name;
    const data =
      name === "review"
        ? { coordinator_note: note }
        : name === "publish"
          ? { description: note }
          : { quantity: Number(quantity), command_id: action.command_id };
    try {
      const response = await post(`/needs/${id}/${name}`, data);
      setNeed(response.need);
      setAction(null);
      setSuccess(
        t(
          {
            review: "reviewedSaved",
            publish: "publishedSaved",
            distribute: "issueSaved",
            confirm: "confirmationSaved",
          }[name],
        ),
      );
      onUpdated();
    } catch (e) {
      setFailure(error(e));
    } finally {
      setBusy(false);
    }
  }
  if (!need)
    return failure ? (
      <ErrorNotice message={failure} onRetry={refreshDetail} />
    ) : (
      <Loading />
    );
  const isCoordinator = user.role === "coordinator";
  return (
    <div className="detail-stack">
      <div className="detail-top">
        <div>
          <span className="reference" dir="ltr">
            {need.reference}
          </span>
          <h3>{t(need.category)}</h3>
          <small>
            {t("recordSource")} · <bdi>{need.resident_name}</bdi>
          </small>
        </div>
        <div className="detail-state">
          <Badge status={need.status} />
          <Button
            variant="quiet"
            onClick={refreshDetail}
            disabled={busy}
            aria-label={t("refresh")}
            title={t("refreshHint")}
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>
      {need.reported_urgent && (
        <Info warning title={t("urgentReported")}>
          {t("urgentNote")}
        </Info>
      )}
      <Info title={t("yourNextAction")}>{t(`next_${need.status}`)}</Info>
      {need.item && (
        <>
          <h3>{t(need.item)}</h3>
          <div className="quantity-grid">
            {[
              ["requested", need.quantity],
              ["promised", need.committed],
              ["receivedQuantity", need.received],
              ["issuedQuantity", need.distributed],
              ["confirmedQuantity", need.confirmed],
              ["unmet", need.remaining],
            ].map(([label, value]) => (
              <div key={label}>
                <small>{t(label)}</small>
                <strong>
                  {value} <span>{t(need.unit)}</span>
                </strong>
              </div>
            ))}
          </div>
        </>
      )}
      {need.category !== "essentials" && (
        <div className="detail-fields">
          <div>
            <small>{t("deviceType")}</small>
            <strong>
              {need.details.device_type === "other"
                ? need.details.other_device
                : t(need.details.device_type)}
            </strong>
          </div>
          <div>
            <small>{t("powerStatus")}</small>
            <strong>{t(need.details.power_status)}</strong>
          </div>
          <div>
            <small>{t("remainingSupply")}</small>
            <strong>{need.details.remaining_supply || t("unknown")}</strong>
          </div>
          <div>
            <small>{t("backup")}</small>
            <strong>{need.details.backup || t("unknown")}</strong>
          </div>
        </div>
      )}
      {need.private_note && (
        <div className="private-note">
          <small>{t("privateNote")}</small>
          <p>{need.private_note}</p>
        </div>
      )}
      {need.coordinator_note && (
        <div className="private-note">
          <small>{t("coordinatorNote")}</small>
          <p>{need.coordinator_note}</p>
        </div>
      )}
      {success && (
        <div className="success-message" role="status">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}
      {failure && <ErrorNotice message={failure} />}
      {!action && (
        <div className="action-row">
          {isCoordinator && !need.reviewed && (
            <Button onClick={() => chooseAction("review")}>
              {t("markReviewed")}
            </Button>
          )}
          {isCoordinator &&
            need.reviewed &&
            !need.published &&
            need.category === "essentials" && (
              <Button onClick={() => chooseAction("publish")}>
                {t("publishNeed")}
              </Button>
            )}
          {isCoordinator && need.received > need.distributed && (
            <Button onClick={() => chooseAction("distribute")}>
              {t("issueSupplies")}
            </Button>
          )}
          {!isCoordinator && need.distributed > need.confirmed && (
            <Button onClick={() => chooseAction("confirm")}>
              {t("confirmMine")}
            </Button>
          )}
        </div>
      )}
      {action && (
        <form onSubmit={submit} className="inline-action form-stack">
          {["review", "publish"].includes(action.name) ? (
            <Field
              label={t(
                action.name === "review" ? "reviewLabel" : "publishLabel",
              )}
              hint={action.name === "publish" ? t("publicHint") : undefined}
            >
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={400}
                required
              />
            </Field>
          ) : (
            <>
              <Info>
                {t(action.name === "distribute" ? "issueHint" : "confirmHint")}
              </Info>
              <Field
                label={t(
                  action.name === "distribute" ? "issueLabel" : "quantity",
                )}
              >
                <input
                  type="number"
                  value={quantity}
                  min={1}
                  step={1}
                  max={
                    action.name === "distribute"
                      ? need.received - need.distributed
                      : need.distributed - need.confirmed
                  }
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </Field>
            </>
          )}
          <div className="action-row">
            <Button type="submit" busy={busy}>
              {t(
                {
                  review: "markReviewed",
                  publish: "publishNeed",
                  distribute: "issueSupplies",
                  confirm: "confirmMine",
                }[action.name],
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
      <h3>{t("timeline")}</h3>
      <ol className="timeline">
        {need.events?.map((event) => (
          <li key={event.id}>
            <span className="timeline-dot">
              <CheckCircle2 size={13} />
            </span>
            <div>
              <strong>
                {t(`event_${event.kind}`)}
                {event.quantity !== null
                  ? ` · ${event.quantity} ${t(need.unit)}`
                  : ""}
              </strong>
              <small>
                {t(event.actor_role)} · {date(event.created_at)}
              </small>
            </div>
          </li>
        ))}
      </ol>
      <p className="small-text">
        {t("supportTeam")}: <bdi>{need.shelter.name}</bdi>
      </p>
    </div>
  );
}

export function CoordinatorHome({ needs, pledges, onOpen, onView }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="page-heading">
        <h1>{t("coordinatorTitle")}</h1>
        <p>{t("coordinatorSub")}</p>
      </div>
      <Metrics
        items={[
          {
            value: needs.filter((n) => !n.reviewed).length,
            label: t("needsReview"),
            icon: ClipboardList,
          },
          {
            value: pledges.filter((p) => p.task?.status === "delivered").length,
            label: t("pendingReceipts"),
            icon: Truck,
          },
          {
            value: needs.filter((n) => n.received > n.distributed).length,
            label: t("distributionPending"),
            icon: Boxes,
          },
        ]}
      />
      <div className="section-heading">
        <h2>{t("reviewQueue")}</h2>
        <button className="text-button" onClick={onView}>
          {t("allRequests")}
        </button>
      </div>
      {needs.length ? (
        <div className="request-grid">
          {[...needs]
            .sort((a, b) => Number(a.reviewed) - Number(b.reviewed))
            .slice(0, 4)
            .map((n) => (
              <RequestCard key={n.id} need={n} onOpen={onOpen} />
            ))}
        </div>
      ) : (
        <Empty title={t("noNeeds")} copy={t("noNeedsCopy")} />
      )}
      <Info title={t("savedHonest")}>{t("receiptHint")}</Info>
    </>
  );
}
