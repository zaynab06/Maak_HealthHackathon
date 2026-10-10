import { useRef, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  HandHeart,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { commandId } from "./api.js";
import {
  Badge,
  Button,
  Empty,
  ErrorNotice,
  Field,
  Info,
  Metrics,
} from "./components.jsx";
import { useLanguage } from "./i18n.jsx";

export function Opportunities({ opportunities, onPledge }) {
  const { t, date } = useLanguage();
  return (
    <>
      <div className="page-heading">
        <h1>{t("pledgeTitle")}</h1>
        <p>{t("pledgeSub")}</p>
      </div>
      <Info title={t("privacyTitle")}>{t("opportunityHint")}</Info>
      {opportunities.length ? (
        <div className="opportunity-grid">
          {opportunities.map((o) => (
            <article className="card opportunity-card" key={o.id}>
              <div className="card-top">
                <span className="icon-tile">
                  <HandHeart size={23} />
                </span>
                <span className="reviewed-label">
                  <ShieldCheck size={14} />
                  {t("reviewedDemo")}
                </span>
              </div>
              <h2>{t(o.item)}</h2>
              <p className="shelter-location">
                <MapPin size={15} />
                <bdi>{o.shelter_name}</bdi> · <bdi>{o.region}</bdi>
              </p>
              <p className="description-copy">{o.description}</p>
              <div className="supply-progress">
                <div>
                  <strong>{o.received}</strong> / {o.quantity} {t(o.unit)}
                  <span>{t("receivedQuantity")}</span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={t("receivedQuantity")}
                  aria-valuemin={0}
                  aria-valuemax={o.quantity}
                  aria-valuenow={o.received}
                >
                  <span
                    style={{
                      width: `${Math.min(100, (o.received / o.quantity) * 100)}%`,
                    }}
                  />
                </div>
                <p>
                  {o.committed} {t(o.unit)} · {t("promised")}
                </p>
              </div>
              <Button
                className="full-width"
                onClick={() => onPledge(o)}
                disabled={!o.can_pledge}
              >
                {o.can_pledge ? t("supportNeed") : t("allPledged")}
              </Button>
              <small className="updated-copy">
                {t("reportFresh")} · {date(o.updated_at)}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={HandHeart}
          title={t("noOpportunities")}
          copy={t("noOpportunitiesCopy")}
        />
      )}
    </>
  );
}

export function Pledges({ pledges, coordinator, onAction, onNeed }) {
  const { t, date } = useLanguage();
  return (
    <>
      <div className="page-heading">
        <h1>{t(coordinator ? "incomingPledges" : "pledges")}</h1>
        <p>{t(coordinator ? "receiptHint" : "pledgeSub")}</p>
      </div>
      {pledges.length ? (
        <div className="request-grid">
          {pledges.map((p) => (
            <article className="card" key={p.id}>
              <div className="card-top">
                <span className="icon-tile">
                  <Package size={22} />
                </span>
                <Badge
                  status={p.status === "available" ? "pledged" : p.status}
                />
              </div>
              <h3>
                {t(p.item)} · {p.quantity} {t(p.unit)}
              </h3>
              <p className="shelter-location">
                <MapPin size={15} />
                <bdi>{p.shelter_name}</bdi>
              </p>
              {coordinator && (
                <p className="small-text">
                  {t("donor")}: <bdi>{p.donor_name}</bdi> ·{" "}
                  <span dir="ltr">{p.need_reference}</span>
                </p>
              )}
              {p.accepted_quantity !== null && (
                <div className="receipt-summary">
                  <CheckCircle2 size={18} />
                  <span>
                    {t("receivedQuantity")}:{" "}
                    <strong>
                      {p.accepted_quantity} {t(p.unit)}
                    </strong>
                  </span>
                </div>
              )}
              {p.receipt_note && (
                <p className="description-copy">{p.receipt_note}</p>
              )}
              <div className="card-footer">
                <small>{date(p.created_at)}</small>
                <div className="action-row">
                  {coordinator && !p.task && (
                    <Button onClick={() => onAction("task", p)}>
                      {t("createTask")}
                    </Button>
                  )}
                  {coordinator && p.task?.status === "delivered" && (
                    <Button onClick={() => onAction("receipt", p)}>
                      {t("confirmShelterReceipt")}
                    </Button>
                  )}
                  {coordinator && p.accepted_quantity !== null && (
                    <Button
                      variant="secondary"
                      onClick={() => onNeed(p.need_id)}
                    >
                      {t("viewRequest")}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={Package}
          title={t("noPledges")}
          copy={t("noPledgesCopy")}
        />
      )}
    </>
  );
}

export function ActionForm({ kind, entity, onSubmit }) {
  const { t, error } = useLanguage();
  const key = useRef(commandId());
  const [quantity, setQuantity] = useState(
    kind === "pledge" ? Math.min(1, entity.can_pledge) : entity.quantity,
  );
  const [note, setNote] = useState(
    kind === "task" ? t("instructionsDefault") : "",
  );
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    try {
      await onSubmit(
        kind === "pledge"
          ? {
              command_id: key.current,
              need_id: entity.id,
              quantity: Number(quantity),
            }
          : kind === "task"
            ? { pickup_instructions: note }
            : { quantity: Number(quantity), receipt_note: note },
      );
    } catch (e) {
      setFailure(error(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <h3>
        {t(entity.item)} · {entity.shelter_name}
      </h3>
      {failure && <ErrorNotice message={failure} />}
      {kind === "task" ? (
        <Field label={t("taskInstructions")} hint={t("instructionsHint")}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={400}
            required
          />
        </Field>
      ) : (
        <>
          <Info>
            {t(kind === "receipt" ? "receiptHint" : "opportunityHint")}
          </Info>
          <Field
            label={`${t(kind === "pledge" ? "pledgeLabel" : "receiptLabel")} (${t(entity.unit)})`}
            hint={
              kind === "pledge"
                ? `${t("pledgeMax")}: ${entity.can_pledge}`
                : undefined
            }
          >
            <input
              type="number"
              min={kind === "receipt" ? 0 : 1}
              max={kind === "pledge" ? entity.can_pledge : entity.quantity}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </Field>
          {kind === "receipt" && (
            <Field label={t("receiptNote")}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required={Number(quantity) < entity.quantity}
                rows={3}
                maxLength={400}
              />
            </Field>
          )}
        </>
      )}
      <Button type="submit" busy={busy} className="full-width">
        {t(
          {
            pledge: "supportNeed",
            task: "createTask",
            receipt: "confirmShelterReceipt",
          }[kind],
        )}
      </Button>
    </form>
  );
}

export function Tasks({ tasks, user, onlyMine, onAction, busy }) {
  const { t, date } = useLanguage();
  const mine = tasks.filter((task) => task.assigned_to_me);
  const available = tasks.filter((task) => task.status === "available");
  const visible =
    user.role === "coordinator" ? tasks : onlyMine ? mine : available;
  return (
    <>
      <div className="page-heading">
        <h1>{t("volunteerTitle")}</h1>
        <p>{t("volunteerSub")}</p>
      </div>
      {user.role === "volunteer" && (
        <Metrics
          items={[
            {
              value: available.length,
              label: t("acceptCount"),
              icon: ClipboardList,
            },
            {
              value: mine.filter((task) => task.status !== "received").length,
              label: t("assignedCount"),
              icon: Truck,
            },
            {
              value: mine.filter((task) => task.status === "received").length,
              label: t("completedCount"),
              icon: CheckCircle2,
            },
          ]}
        />
      )}
      {user.role === "volunteer" && !user.volunteer_approved && (
        <Info warning>{t("volunteerPending")}</Info>
      )}
      {visible.length ? (
        <div className="request-grid">
          {visible.map((task) => (
            <article className="card task-card" key={task.id}>
              <div className="card-top">
                <span className="icon-tile">
                  <Truck size={23} />
                </span>
                <Badge status={task.status} />
              </div>
              <h3>
                {t(task.item)} · {task.quantity} {t(task.unit)}
              </h3>
              <p className="shelter-location">
                <MapPin size={15} />
                <bdi>{task.shelter_name}</bdi> · <bdi>{task.region}</bdi>
              </p>
              {task.pickup_instructions && (
                <div className="private-note">
                  <small>{t("pickupInstructions")}</small>
                  <p>{task.pickup_instructions}</p>
                </div>
              )}
              <div className="card-footer">
                <small>{date(task.updated_at)}</small>
                <div className="action-row">
                  {user.role === "volunteer" && task.status === "available" && (
                    <Button
                      disabled={!user.volunteer_approved || busy}
                      onClick={() => onAction(task.id, "accept")}
                    >
                      {t("acceptTask")}
                    </Button>
                  )}
                  {task.assigned_to_me && task.status === "assigned" && (
                    <Button
                      disabled={busy}
                      onClick={() => onAction(task.id, "pickup")}
                    >
                      {t("markPickup")}
                    </Button>
                  )}
                  {task.assigned_to_me && task.status === "picked_up" && (
                    <Button
                      disabled={busy}
                      onClick={() => onAction(task.id, "deliver")}
                    >
                      {t("markDelivered")}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={Truck}
          title={t(onlyMine ? "noMyTasks" : "noTasks")}
          copy={t(onlyMine ? "noMyTasksCopy" : "noTasksCopy")}
        />
      )}
      <Info>{t("taskPrivacy")}</Info>
    </>
  );
}

export function ShelterView({ shelter, stock, onSubmit }) {
  const { t, date, error } = useLanguage();
  const [capacity, setCapacity] = useState(shelter.capacity);
  const [occupancy, setOccupancy] = useState(shelter.occupancy);
  const [power, setPower] = useState(shelter.power_status);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    try {
      await onSubmit({
        capacity: Number(capacity),
        occupancy: Number(occupancy),
        power_status: power,
      });
    } catch (e) {
      setFailure(error(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <h1>{t("shelterReport")}</h1>
        <p>{t("shelterSub")}</p>
      </div>
      <div className="two-column">
        <article className="card">
          <h2>
            <bdi>{shelter.name}</bdi>
          </h2>
          <p className="shelter-location">
            <MapPin size={15} />
            {shelter.region}
          </p>
          <form className="form-stack" onSubmit={submit}>
            {failure && <ErrorNotice message={failure} />}
            <div className="field-pair">
              <Field label={t("capacity")}>
                <input
                  type="number"
                  value={capacity}
                  min={0}
                  max={100000}
                  step={1}
                  onChange={(e) => setCapacity(e.target.value)}
                  required
                />
              </Field>
              <Field label={t("occupancy")}>
                <input
                  type="number"
                  value={occupancy}
                  min={0}
                  max={100000}
                  step={1}
                  onChange={(e) => setOccupancy(e.target.value)}
                  required
                />
              </Field>
            </div>
            {Number(occupancy) > Number(capacity) && (
              <Info warning>{t("overcapacity")}</Info>
            )}
            <Field label={t("powerStatus")}>
              <select value={power} onChange={(e) => setPower(e.target.value)}>
                {["unknown", "reported_available", "reported_unavailable"].map(
                  (p) => (
                    <option value={p} key={p}>
                      {t(p)}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Button type="submit" busy={busy}>
              {t("updateReport")}
            </Button>
            <p className="small-text">
              {t("reportFresh")} · {date(shelter.updated_at)}
            </p>
          </form>
        </article>
        <article className="card">
          <h2>{t("stock")}</h2>
          {stock.length ? (
            <div className="stock-list">
              {stock.map((s) => (
                <div key={s.item + s.unit}>
                  <span className="icon-tile">
                    <Boxes size={21} />
                  </span>
                  <div>
                    <strong>{t(s.item)}</strong>
                    <small>{date(s.updated_at)}</small>
                  </div>
                  <b>
                    {s.quantity} {t(s.unit)}
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={Boxes} title={t("noStock")} copy={t("noStockCopy")} />
          )}
          <Info>{t("receiptHint")}</Info>
        </article>
      </div>
    </>
  );
}

export function MinistryView({ overview, view }) {
  const { t, date } = useLanguage();
  return (
    <>
      <div className="page-heading">
        <h1>{t("ministryTitle")}</h1>
        <p>{t("ministrySub")}</p>
      </div>
      <Metrics
        items={[
          {
            value: overview.metrics.shelters,
            label: t("reportingShelters"),
            icon: Boxes,
          },
          {
            value: overview.metrics.open_needs,
            label: t("totalOpenNeeds"),
            icon: ClipboardList,
          },
          {
            value: overview.metrics.received_deliveries,
            label: t("receivedDeliveries"),
            icon: Truck,
          },
        ]}
      />
      {view !== "distribution" && (
        <article className="card">
          <div className="section-heading">
            <h2>{t("shelters")}</h2>
            <span className="small-text">{t("coverageNote")}</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "shelterName",
                    "region",
                    "capacity",
                    "occupancy",
                    "spaces",
                    "reportFresh",
                  ].map((k) => (
                    <th key={k}>{t(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.shelters.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      {s.overcrowded && (
                        <span className="overcapacity-label">
                          {t("overcapacity")}
                        </span>
                      )}
                    </td>
                    <td>{s.region}</td>
                    <td>{s.capacity}</td>
                    <td>{s.occupancy}</td>
                    <td>{s.available_spaces}</td>
                    <td className="date-cell">{date(s.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
      {view !== "shelters" && (
        <article className="card">
          <div className="section-heading">
            <h2>{t("distributionTitle")}</h2>
          </div>
          <p className="description-copy">{t("distributionNote")}</p>
          {overview.distribution.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "shelterName",
                      "item",
                      "requested",
                      "promised",
                      "receivedQuantity",
                      "issuedQuantity",
                      "confirmedQuantity",
                      "unmet",
                    ].map((k) => (
                      <th key={k}>{t(k)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.distribution.map((row) => (
                    <tr key={row.shelter_name + row.item + row.unit}>
                      <td>{row.shelter_name}</td>
                      <td>
                        {t(row.item)}
                        <small className="block">{t(row.unit)}</small>
                      </td>
                      {[
                        "requested",
                        "committed",
                        "received",
                        "distributed",
                        "confirmed",
                        "remaining",
                      ].map((k) => (
                        <td key={k}>
                          <strong
                            className={
                              k === "remaining" && row[k] > 0
                                ? "unmet-value"
                                : ""
                            }
                          >
                            {row[k]}
                          </strong>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              icon={Package}
              title={t("noDistribution")}
              copy={t("noDistributionCopy")}
            />
          )}
        </article>
      )}
      <Info title={t("privacyTitle")}>{t("overviewPrivacy")}</Info>
      <p className="small-text">
        {t("lastRefresh")} · {date(overview.generated_at)}
      </p>
    </>
  );
}
