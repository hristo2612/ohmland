import { useId, useRef, useState } from "react";
import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { useDerived, useLearner, useLearnerReady } from "../progress/useLearner";
import type { Settings } from "../progress/types";
import { AccountCard } from "./AccountCard";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import type { IconName } from "./icons";
import { toast } from "./toast-store";
import "./account.css";

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string; icon?: IconName }[]; onChange(v: T): void }) {
  const id = useId();
  return (
    <div className="setting">
      <span className="setting__label" id={id}>
        {label}
      </span>
      <div className="tabs__list" role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} className="tabs__tab" onClick={() => onChange(o.id)}>
            {o.icon && <Icon name={o.icon} size={16} />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The account page: sign-in or the signed-in account, where progress lives, export, import and delete, and settings. */
export default function AccountPanel({ outline }: { outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const persistence = useLearner((s) => s.persistence);
  const settings = useLearner((s) => s.learner.settings);
  const d = useDerived(outline);
  const [confirm, setConfirm] = useState(false);
  const [synced, setSynced] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const storage = persistence === "memory" ? "memory" : synced ? "synced" : "local";

  const exportFile = () => {
    const blob = new Blob([useLearner.getState().exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ohmland-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const ok = await useLearner.getState().importJson(await file.text());
    toast(ok ? { title: m.account.importDone, tone: "good", icon: "check-circle" } : { title: m.account.importFailed, tone: "warn", icon: "alert" });
    if (fileRef.current) fileRef.current.value = "";
  };

  const reset = async () => {
    await useLearner.getState().reset();
    setConfirm(false);
    toast({ title: m.account.resetDone, icon: "trash" });
  };

  const set = (patch: Partial<Settings>) => useLearner.getState().setSettings(patch);

  return (
    <div className="account">
      <AccountCard onSignedIn={setSynced} />

      <section className="account__section account__storage" aria-labelledby="storage-title">
        <h2 id="storage-title" className="account__title">
          {m.account.storageTitle}
        </h2>
        {ready ? (
          <div className="account__status" data-tone={storage === "memory" ? "warn" : "good"}>
            <Icon name={storage === "memory" ? "alert" : storage === "synced" ? "cloud-check" : "device"} size={22} />
            <div>
              <p className="account__status-title">
                {storage === "memory" ? m.account.storageMemory : storage === "synced" ? m.account.storageSynced : m.account.storageLocal}
              </p>
              <p className="small muted">
                {storage === "memory" ? m.account.storageMemoryBody : storage === "synced" ? m.account.storageSyncedBody : m.account.storageLocalBody}
              </p>
              <p className="small muted tabular">{m.account.stats(d.lessonsDone, d.xp.total)}</p>
            </div>
          </div>
        ) : (
          <p className="muted">{m.common.loading}</p>
        )}
      </section>

      <section className="account__section account__data" aria-labelledby="data-title">
        <h2 id="data-title" className="account__title">
          {m.account.dataTitle}
        </h2>
        <div className="account__row">
          <div>
            <p className="account__row-title">{m.account.export}</p>
            <p className="small muted">{m.account.exportBody}</p>
          </div>
          <Button variant="secondary" icon="download" onClick={exportFile} disabled={!ready}>
            {m.account.export}
          </Button>
        </div>
        <div className="account__row">
          <div>
            <p className="account__row-title">{m.account.import}</p>
            <p className="small muted">{m.account.importBody}</p>
          </div>
          <Button variant="secondary" icon="upload" onClick={() => fileRef.current?.click()} disabled={!ready}>
            {m.account.import}
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => importFile(e.target.files?.[0])} />
        </div>
        <div className="account__row">
          <div>
            <p className="account__row-title">{m.account.reset}</p>
            <p className="small muted">{synced ? m.account.resetBodySynced : m.account.resetBody}</p>
          </div>
          <Button variant="danger" icon="trash" onClick={() => setConfirm(true)} disabled={!ready}>
            {m.account.reset}
          </Button>
        </div>
      </section>

      <section className="account__section account__settings" aria-labelledby="settings-title">
        <h2 id="settings-title" className="account__title">
          {m.account.settingsTitle}
        </h2>
        <Segmented
          label={m.account.themeLabel}
          value={settings.theme}
          onChange={(theme) => set({ theme })}
          options={[
            { id: "system", label: m.theme.system, icon: "monitor" },
            { id: "light", label: m.theme.light, icon: "sun" },
            { id: "dark", label: m.theme.dark, icon: "moon" },
          ]}
        />
        <Segmented
          label={m.account.motionLabel}
          value={settings.reducedMotion}
          onChange={(reducedMotion) => set({ reducedMotion })}
          options={[
            { id: "system", label: m.account.motion.system ?? "" },
            { id: "on", label: m.account.motion.on ?? "" },
            { id: "off", label: m.account.motion.off ?? "" },
          ]}
        />
        <Segmented
          label={m.account.soundLabel}
          value={settings.muted ? "off" : "on"}
          onChange={(v) => set({ muted: v === "off" })}
          options={[
            { id: "on", label: m.account.soundOn, icon: "sound-on" },
            { id: "off", label: m.account.soundOff, icon: "sound-off" },
          ]}
        />
      </section>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={m.account.resetTitle}
        description={synced ? m.account.resetConfirmBodySynced : m.account.resetConfirmBody}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {m.common.cancel}
            </Button>
            <Button variant="danger" icon="trash" onClick={reset}>
              {m.account.resetConfirm}
            </Button>
          </>
        }
      />
    </div>
  );
}
