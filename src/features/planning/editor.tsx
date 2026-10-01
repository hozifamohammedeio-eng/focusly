"use client";
import { useRef, useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { mutate, type MutationResult } from "./actions";
import { localParts, type Subject, type Task, type Block } from "./logic";
import type { PlanningCopy } from "@/features/i18n/phase3";
import { useCopy } from "@/features/i18n/use-copy";
import { subjectLabel } from "@/features/i18n/phase2";
export type EditorState =
  | { entity: "subjects"; row?: Subject }
  | { entity: "tasks"; row?: Task; day?: string }
  | { entity: "study_blocks"; row?: Block; day?: string };
export function Editor({
  editor,
  subjects,
  t,
  zone,
  today,
  onClose,
  onSaved,
  onDelete,
}: {
  editor: EditorState;
  subjects: Subject[];
  t: PlanningCopy;
  zone: string;
  today: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  onDelete: () => void;
}) {
  const p2 = useCopy();
  const form = useRef<HTMLFormElement>(null),
    [pending, startTransition] = useTransition(),
    [error, setError] = useState<MutationResult["error"]>();
  const task = editor.entity === "tasks" ? editor.row : undefined,
    block = editor.entity === "study_blocks" ? editor.row : undefined,
    subject = editor.entity === "subjects" ? editor.row : undefined;
  const initialDuration = block
    ? (Date.parse(block.ends_at) - Date.parse(block.starts_at)) / 60000
    : 45;
  const [preset, setPreset] = useState(
    [25, 45, 60, 90].includes(initialDuration)
      ? String(initialDuration)
      : "custom",
  );
  const [subjectId, setSubjectId] = useState(
    task?.subject_id || block?.subject_id || "",
  );
  const blockZone = block?.time_zone || zone;
  const initial = block
    ? localParts(block.starts_at, blockZone)
    : task?.due_at
      ? { day: task.task_date, time: localParts(task.due_at, zone).time }
      : {
          day:
            task?.task_date ||
            (editor.entity === "tasks"
              ? editor.day || today
              : editor.entity === "study_blocks"
                ? editor.day || today
                : ""),
          time:
            editor.entity === "study_blocks"
              ? "16:00"
              : "",
        };
  const label =
    editor.entity === "subjects"
      ? subject
        ? t.edit
        : t.addSubject
      : editor.entity === "tasks"
        ? task
          ? t.edit
          : t.newTask
        : block
          ? t.editSession
          : t.newSession;
  function submit(allow = false) {
    if (!form.current?.reportValidity()) return;
    const values = new FormData(form.current);
    values.set("entity", editor.entity);
    values.set("action", "save");
    if (editor.row) values.set("id", editor.row.id);
    if (allow) values.set("allow_overlap", "true");
    startTransition(async () => {
      try {
        const result = await mutate(values);
        if (result.error) {
          setError(result.error);
          return;
        }
        onSaved(t.saved);
        onClose();
      } catch {
        setError("saveError");
      }
    });
  }
  const selectable = subjects.filter(
    (s) => !s.archived_at || s.id === subjectId,
  );
  return (
    <Dialog title={label} closeLabel={t.close} busy={pending} onClose={onClose}>
      <form
        ref={form}
        className="grid gap-5 pt-6"
        onChange={() => setError(undefined)}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {editor.entity === "subjects" ? (
          <>
            <Field
              label={t.name}
              name="name"
              required
              maxLength={80}
              defaultValue={subject?.name || ""}
              hint={t.limitName}
            />
            <Field
              label={t.color}
              name="color"
              type="color"
              defaultValue={subject?.color || "#6558d3"}
              required
            />
          </>
        ) : (
          <>
            {editor.entity === "tasks" && (
              <>
                <Field
                  label={t.title}
                  name="title"
                  required
                  maxLength={200}
                  defaultValue={task?.title || ""}
                />
                <label className="grid gap-2 text-sm font-semibold">
                  {t.notes} ({t.optional})
                  <textarea
                    className="field min-h-24"
                    name="notes"
                    maxLength={5000}
                    defaultValue={task?.notes || ""}
                  />
                </label>
              </>
            )}
            <label className="grid gap-2 text-sm font-semibold">
              {t.subject}
              <select
                className="field"
                name="subject_id"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                required={editor.entity === "study_blocks"}
              >
                <option value="">{t.noSubject}</option>
                {selectable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {subjectLabel(p2, s.name)}
                    {s.archived_at ? ` (${t.archived})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={
                  editor.entity === "tasks"
                    ? t.date
                    : block?.repeat_weekly
                      ? t.seriesDate
                      : t.sessionDay
                }
                name="date"
                type="date"
                required={
                  editor.entity ===
                    "study_blocks" ||
                  editor.entity ===
                    "tasks"
                }
                defaultValue={
                  initial.day
                }
              />
              <Field
                label={editor.entity === "tasks" ? t.time : t.start}
                name="time"
                type="time"
                required={editor.entity === "study_blocks"}
                defaultValue={initial.time}
              />
            </div>
            {editor.entity === "tasks" ? (
              <>
                <p className="muted text-xs">{t.dateOnly}</p>
                <label className="grid gap-2 text-sm font-semibold">
                  {t.priority}
                  <select
                    className="field"
                    name="priority"
                    defaultValue={task?.priority || "medium"}
                  >
                    {(["low", "medium", "high"] as const).map((p) => (
                      <option key={p} value={p}>
                        {t[p]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <input
                  type="hidden"
                  name="title"
                  value={
                    subjects.find((s) => s.id === subjectId)?.name || t.session
                  }
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold">
                    {t.duration}
                    <select
                      className="field"
                      value={preset}
                      onChange={(e) => setPreset(e.target.value)}
                    >
                      {[25, 45, 60, 90].map((n) => (
                        <option key={n} value={n}>
                          {n} {t.minutes}
                        </option>
                      ))}
                      <option value="custom">{t.custom}</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    {t.repeat}
                    <select
                      className="field"
                      name="repeat"
                      defaultValue={block?.repeat_weekly ? "weekly" : "never"}
                    >
                      <option value="never">{t.never}</option>
                      <option value="weekly">{t.weekly}</option>
                    </select>
                  </label>
                </div>
                {preset === "custom" ? (
                  <Field
                    label={`${t.duration} (${t.minutes})`}
                    name="duration"
                    type="number"
                    min={5}
                    max={720}
                    step={1}
                    required
                    defaultValue={initialDuration}
                  />
                ) : (
                  <input name="duration" type="hidden" value={preset} />
                )}
                <Field
                  label={t.zone}
                  name="zone"
                  value={blockZone}
                  readOnly
                  dir="ltr"
                />
                <p className="muted text-xs leading-6">{t.repeatHelp}</p>
              </>
            )}
          </>
        )}
        {error && (
          <div role="alert" className="form-error">
            {t[error]}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-5">
          {editor.row && (
            <Button
              variant="ghost"
              className="me-auto"
              disabled={pending}
              onClick={onDelete}
            >
              {t.remove}
            </Button>
          )}
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            {t.cancel}
          </Button>
          {error === "overlap" ? (
            <Button disabled={pending} onClick={() => submit(true)}>
              {pending ? t.saving : t.proceed}
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? t.saving : t.save}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
export function DeleteDialog({
  entity,
  id,
  weekly,
  t,
  onClose,
  onSaved,
}: {
  entity: EditorState["entity"];
  id: string;
  weekly: boolean;
  t: PlanningCopy;
  onClose: () => void;
  onSaved: (s: string) => void;
}) {
  const [pending, start] = useTransition(),
    [error, setError] = useState<MutationResult["error"]>();
  return (
    <Dialog
      title={
        entity === "subjects"
          ? t.deleteSubject
          : entity === "tasks"
            ? t.deleteTask
            : t.deleteSession
      }
      closeLabel={t.close}
      onClose={onClose}
      busy={pending}
    >
      <p className="muted py-6 leading-7">
        {entity === "subjects"
          ? t.subjectSafety
          : weekly
            ? t.deleteSeries
            : t.irreversible}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {t[error]}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={pending} onClick={onClose}>
          {t.cancel}
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                const f = new FormData();
                f.set("entity", entity);
                f.set("action", "delete");
                f.set("id", id);
                const r = await mutate(f);
                if (r.error) {
                  setError(r.error);
                  return;
                }
                onSaved(r.success === "archived" ? t.archivedToast : t.deleted);
                onClose();
              } catch {
                setError("saveError");
              }
            })
          }
        >
          {pending ? t.saving : t.remove}
        </Button>
      </div>
    </Dialog>
  );
}
