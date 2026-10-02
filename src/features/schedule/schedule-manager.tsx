"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
} from "@/components/ui/card";

import {
  Field,
} from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { PushNotifications } from "./push-notifications";

import type {
  Database,
} from "@/types/database";

import {
  deleteScheduleItem,
  saveScheduleItem,
} from "./actions";


type Item =
  Database[
    "public"
  ][
    "Tables"
  ][
    "study_schedule_items"
  ][
    "Row"
  ];


type Subject =
  Database[
    "public"
  ][
    "Tables"
  ][
    "subjects"
  ][
    "Row"
  ];


const weekdayOrder =
  [
    6,
    0,
    1,
    2,
    3,
    4,
    5,
  ];


const copy = {

  ar: {

    title:
      "جدول الدروس والمحاضرات",

    subtitle:
      "احتفظ بمواعيد دروسك ومحاضراتك المتكررة في مكان واحد.",

    add:
      "إضافة موعد",

    edit:
      "تعديل الموعد",

    name:
      "اسم الدرس أو المحاضرة",

    subject:
      "المادة",

    noSubject:
      "بدون مادة محددة",

    kind:
      "نوع الموعد",

    lesson:
      "درس",

    lecture_release:
      "نزول محاضرة",

    day:
      "اليوم",

    time:
      "الوقت",

    optionalTime:
      "اختياري لو المحاضرة ملهاش وقت ثابت",

    reminder:
      "التذكير",

    noReminder:
      "بدون تذكير",

    atTime:
      "وقت الموعد",

    before15:
      "قبل 15 دقيقة",

    before30:
      "قبل 30 دقيقة",

    before60:
      "قبل ساعة",

    before120:
      "قبل ساعتين",

    beforeDay:
      "قبل يوم",

    notification:
      "فعّل التذكير لهذا الموعد",

    notificationNote:
      "سيُحفظ اختيار التذكير مع هذا الموعد.",

    save:
      "حفظ",

    saving:
      "جارٍ الحفظ…",

    cancel:
      "إلغاء",

    remove:
      "حذف",

    empty:
      "لسه مفيش مواعيد. أضف أول درس أو محاضرة.",

    saved:
      "تم حفظ الموعد.",

    deleted:
      "تم حذف الموعد.",

    invalid:
      "راجع البيانات المكتوبة.",

    expired:
      "الجلسة انتهت. سجّل الدخول مرة أخرى.",

    saveError:
      "حصل خطأ أثناء الحفظ.",

    notFound:
      "الموعد غير موجود.",

    confirmDelete:
      "متأكد إنك عايز تحذف الموعد؟",

    days: [
      "الأحد",
      "الاثنين",
      "الثلاثاء",
      "الأربعاء",
      "الخميس",
      "الجمعة",
      "السبت",
    ],

  },


  en: {

    title:
      "Lessons & Lecture Schedule",

    subtitle:
      "Keep recurring lessons and lecture releases in one place.",

    add:
      "Add schedule item",

    edit:
      "Edit schedule item",

    name:
      "Lesson or lecture name",

    subject:
      "Subject",

    noSubject:
      "No specific subject",

    kind:
      "Type",

    lesson:
      "Lesson",

    lecture_release:
      "Lecture release",

    day:
      "Day",

    time:
      "Time",

    optionalTime:
      "Optional if there is no fixed time",

    reminder:
      "Reminder",

    noReminder:
      "No reminder",

    atTime:
      "At scheduled time",

    before15:
      "15 minutes before",

    before30:
      "30 minutes before",

    before60:
      "1 hour before",

    before120:
      "2 hours before",

    beforeDay:
      "1 day before",

    notification:
      "Enable reminder for this item",

    notificationNote:
      "Your reminder preference is saved with this item.",

    save:
      "Save",

    saving:
      "Saving…",

    cancel:
      "Cancel",

    remove:
      "Delete",

    empty:
      "No schedule items yet.",

    saved:
      "Schedule item saved.",

    deleted:
      "Schedule item deleted.",

    invalid:
      "Please review the information.",

    expired:
      "Your session expired. Please sign in again.",

    saveError:
      "Could not save the item.",

    notFound:
      "Schedule item not found.",

    confirmDelete:
      "Delete this schedule item?",

    days: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],

  },

} as const;


function ScheduleForm({
  item,
  subjects,
  zone,
  locale,
  onDone,
  onCancel,
}: {

  item:
    Item | null;

  subjects:
    Subject[];

  zone:
    string;

  locale:
    "ar" | "en";

  onDone:
    () => void;

  onCancel:
    () => void;

}) {

  const t =
    copy[
      locale
    ];


  const router =
    useRouter();


  const [
    pending,
    start,
  ] =
    useTransition();


  const [
    error,
    setError,
  ] =
    useState(
      "",
    );


  const [
    time,
    setTime,
  ] =
    useState(
      item?.local_time?.slice(
        0,
        5,
      ) || "",
    );


  const [
    notify,
    setNotify,
  ] =
    useState(
      item?.notifications_enabled ||
        false,
    );


  function submit(
    form:
      FormData,
  ) {

    form.set(
      "time_zone",
      zone,
    );


    form.set(
      "notifications_enabled",
      String(
        notify,
      ),
    );


    start(
      async () => {

        const result =
          await saveScheduleItem(
            form,
          );


        if (
          result.error
        ) {

          setError(
            t[
              result.error
            ],
          );

          return;
        }


        router.refresh();

        onDone();
      },
    );
  }


  return (

    <div className="pt-5">


      <form
        action={submit}
        className="grid gap-5"
      >

        {
          item && (

            <input
              type="hidden"
              name="id"
              value={
                item.id
              }
            />

          )
        }


        <Field
          label={
            t.name
          }
          name="title"
          required
          maxLength={
            200
          }
          defaultValue={
            item?.title ||
            ""
          }
        />


        <div
          className="grid gap-4 sm:grid-cols-2"
        >

          <label
            className="grid gap-2 text-sm font-semibold"
          >

            {
              t.subject
            }


            <select
              className="field"
              name="subject_id"
              defaultValue={
                item?.subject_id ||
                ""
              }
            >

              <option
                value=""
              >
                {
                  t.noSubject
                }
              </option>


              {
                subjects

                  .filter(
                    (
                      subject,
                    ) =>
                      !subject.archived_at ||
                      subject.id ===
                        item?.subject_id,
                  )

                  .map(
                    (
                      subject,
                    ) => (

                      <option
                        key={
                          subject.id
                        }
                        value={
                          subject.id
                        }
                      >

                        {
                          subject.name
                        }

                      </option>

                    ),
                  )
              }

            </select>

          </label>


          <label
            className="grid gap-2 text-sm font-semibold"
          >

            {
              t.kind
            }


            <select
              className="field"
              name="kind"
              defaultValue={
                item?.kind ||
                "lesson"
              }
            >

              <option
                value="lesson"
              >
                {
                  t.lesson
                }
              </option>


              <option
                value="lecture_release"
              >
                {
                  t.lecture_release
                }
              </option>

            </select>

          </label>

        </div>


        <div
          className="grid gap-4 sm:grid-cols-2"
        >

          <label
            className="grid gap-2 text-sm font-semibold"
          >

            {
              t.day
            }


            <select
              className="field"
              name="weekday"
              defaultValue={
                String(
                  item?.weekday ??
                    6,
                )
              }
            >

              {
                weekdayOrder.map(
                  (
                    day,
                  ) => (

                    <option
                      key={
                        day
                      }
                      value={
                        day
                      }
                    >

                      {
                        t.days[
                          day
                        ]
                      }

                    </option>

                  ),
                )
              }

            </select>

          </label>


          <label
            className="grid gap-2 text-sm font-semibold"
          >

            {
              t.time
            }


            <input
              className="field"
              type="time"
              name="local_time"
              value={
                time
              }
              onChange={
                (
                  event,
                ) => {

                  setTime(
                    event.target.value,
                  );


                  if (
                    !event.target.value
                  ) {

                    setNotify(
                      false,
                    );
                  }
                }
              }
            />


            <span
              className="muted text-xs"
            >
              {
                t.optionalTime
              }
            </span>

          </label>

        </div>


        <label
          className="grid gap-2 text-sm font-semibold"
        >

          {
            t.reminder
          }


          <select
            className="field"
            name="remind_before_minutes"
            defaultValue={
              item?.remind_before_minutes ===
              null

                ? ""

                : String(
                    item?.remind_before_minutes ??
                      30,
                  )
            }
          >

            <option
              value=""
            >
              {
                t.noReminder
              }
            </option>


            <option
              value="0"
            >
              {
                t.atTime
              }
            </option>


            <option
              value="15"
            >
              {
                t.before15
              }
            </option>


            <option
              value="30"
            >
              {
                t.before30
              }
            </option>


            <option
              value="60"
            >
              {
                t.before60
              }
            </option>


            <option
              value="120"
            >
              {
                t.before120
              }
            </option>


            <option
              value="1440"
            >
              {
                t.beforeDay
              }
            </option>

          </select>

        </label>


        <label
          className="flex items-start gap-3 rounded-2xl border p-4"
        >

          <input
            type="checkbox"
            checked={
              notify
            }
            disabled={
              !time
            }
            onChange={
              (
                event,
              ) =>
                setNotify(
                  event.target.checked,
                )
            }
          />


          <span>

            <span
              className="block text-sm font-semibold"
            >
              {
                t.notification
              }
            </span>


            <span
              className="muted mt-1 block text-xs leading-5"
            >
              {
                t.notificationNote
              }
            </span>

          </span>

        </label>


        {
          error && (

            <div
              className="form-error"
              role="alert"
            >
              {
                error
              }
            </div>

          )
        }


        <div
          className="flex flex-wrap justify-end gap-2"
        >

          {
            item && (

              <Button
                type="button"
                variant="ghost"
                onClick={
                  onCancel
                }
              >
                {
                  t.cancel
                }
              </Button>

            )
          }


          <Button
            type="submit"
            disabled={
              pending
            }
          >

            {
              pending
                ? t.saving
                : t.save
            }

          </Button>

        </div>

      </form>

    </div>
  );
}


export function ScheduleManager({
  items,
  subjects,
  zone,
  locale,
}: {

  items:
    Item[];

  subjects:
    Subject[];

  zone:
    string;

  locale:
    "ar" | "en";

}) {

  const t =
    copy[
      locale
    ];


  const router =
    useRouter();


  const [
    editing,
    setEditing,
  ] =
    useState<
      Item | null
    >(
      null,
    );

  const [formOpen, setFormOpen] = useState(false);


  const [
    message,
    setMessage,
  ] =
    useState(
      "",
    );


  const [
    pending,
    start,
  ] =
    useTransition();


  const subjectName = (
    id:
      string | null,
  ) =>
    subjects.find(
      (
        subject,
      ) =>
        subject.id ===
        id,
    )?.name ||
    t.noSubject;


  const visibleItems = items.filter((item) => item.enabled);

  const grouped =
    weekdayOrder.map(
      (
        day,
      ) => ({
        day,

        rows:
          visibleItems.filter(
            (
              item,
            ) =>
              item.weekday ===
                day,
          ),
      }),
    );


  function remove(
    item:
      Item,
  ) {

    if (
      !window.confirm(
        t.confirmDelete,
      )
    ) {
      return;
    }


    start(
      async () => {

        const result =
          await deleteScheduleItem(
            item.id,
          );


        if (
          result.error
        ) {

          setMessage(
            t[
              result.error
            ],
          );

          return;
        }


        if (
          editing?.id ===
          item.id
        ) {

          setEditing(
            null,
          );
          setFormOpen(false);
        }


        setMessage(
          t.deleted,
        );


        router.refresh();
      },
    );
  }


  return (

    <main
      id="main"
      className="study-main"
    >

      <div
        className="page-heading"
      >

        <div>

          <h1
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {
              t.title
            }
          </h1>


          <p
            className="muted mt-3 max-w-3xl leading-7"
          >
            {
              t.subtitle
            }
          </p>

        </div>

        <Button type="button" onClick={() => { setEditing(null); setFormOpen(true); }}>
          + {t.add}
        </Button>

      </div>


      {
        message && (

          <div
            className="study-toast mb-5"
            role="status"
          >

            <span>
              {
                message
              }
            </span>


            <Button
              variant="ghost"
              onClick={
                () =>
                  setMessage(
                    "",
                  )
              }
            >
              ×
            </Button>

          </div>

        )
      }


      <div className="mx-auto w-full max-w-4xl">

        <div
          className="grid gap-5"
        >

          {
            visibleItems.length ===
            0

              ? (

                <Card>

                  <p
                    className="muted"
                  >
                    {
                      t.empty
                    }
                  </p>

                </Card>

              )

              : grouped.map(
                  ({
                    day,
                    rows,
                  }) =>

                    rows.length

                      ? (

                        <section
                          key={
                            day
                          }
                          className="border-b border-[var(--border)] pb-5"
                        >

                          <h2
                            className="mb-4 text-lg font-semibold"
                          >
                            {
                              t.days[
                                day
                              ]
                            }
                          </h2>


                          <div
                            className="grid gap-3"
                          >

                            {
                              rows.map(
                                (
                                  item,
                                ) => (

                                  <article
                                    key={
                                      item.id
                                    }
                                    className="rounded-xl bg-[var(--surface)] px-4 py-3"
                                  >

                                    <div
                                      className="flex flex-wrap items-start justify-between gap-3"
                                    >

                                      <div>

                                        <h3
                                          className="font-semibold"
                                        >
                                          {
                                            item.title
                                          }
                                        </h3>


                                        <p
                                          className="muted mt-1 text-sm"
                                        >

                                          {
                                            t[
                                              item.kind
                                            ]
                                          }

                                          {" · "}

                                          {
                                            subjectName(
                                              item.subject_id,
                                            )
                                          }


                                          {
                                            item.local_time

                                              ? ` · ${item.local_time.slice(
                                                  0,
                                                  5,
                                                )}`

                                              : ""
                                          }

                                        </p>


                                        {
                                          item.remind_before_minutes !==
                                            null && (

                                            <p
                                              className="muted mt-2 text-xs"
                                            >

                                              {
                                                t.reminder
                                              }

                                              {": "}

                                              {
                                                item.remind_before_minutes === 0

                                                  ? t.atTime

                                                  : item.remind_before_minutes ===
                                                      15

                                                    ? t.before15

                                                    : item.remind_before_minutes ===
                                                        30

                                                      ? t.before30

                                                      : item.remind_before_minutes ===
                                                          60

                                                        ? t.before60

                                                        : item.remind_before_minutes ===
                                                            120

                                                          ? t.before120

                                                          : item.remind_before_minutes ===
                                                              1440

                                                            ? t.beforeDay

                                                            : `${item.remind_before_minutes} min`
                                              }

                                            </p>

                                          )
                                        }

                                      </div>


                                      <div
                                        className="flex gap-2"
                                      >

                                        <Button
                                          variant="ghost"
                                          disabled={
                                            pending
                                          }
                                          onClick={
                                            () => {
                                              setEditing(
                                                item,
                                              );
                                              setFormOpen(true);
                                            }
                                          }
                                        >
                                          {
                                            t.edit
                                          }
                                        </Button>


                                        <Button
                                          variant="ghost"
                                          disabled={
                                            pending
                                          }
                                          onClick={
                                            () =>
                                              remove(
                                                item,
                                              )
                                          }
                                        >
                                          {
                                            t.remove
                                          }
                                        </Button>

                                      </div>

                                    </div>

                                  </article>

                                ),
                              )
                            }

                          </div>

                        </section>

                      )

                      : null,
                )
          }

        </div>


        <section className="mt-8 border-t border-[var(--border)] pt-6" aria-label={locale === "ar" ? "إشعارات المواعيد" : "Schedule notifications"}>
          <PushNotifications locale={locale} />
        </section>

      </div>

      {formOpen && <Dialog title={editing ? t.edit : t.add} closeLabel={t.cancel} onClose={() => { setFormOpen(false); setEditing(null); }}>
          <ScheduleForm
            key={
              editing?.id ||
              "new"
            }
            item={
              editing
            }
            subjects={
              subjects
            }
            zone={
              zone
            }
            locale={
              locale
            }
            onDone={
              () => {

                setMessage(
                  t.saved,
                );

                setEditing(
                  null,
                );
                setFormOpen(false);

                router.refresh();
              }
            }
            onCancel={() => { setFormOpen(false); setEditing(null); }}
          />
      </Dialog>}

    </main>
  );
}
