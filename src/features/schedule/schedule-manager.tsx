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

    eyebrow:
      "المساعد الدراسي الذكي",

    title:
      "جدول الدروس والمحاضرات",

    subtitle:
      "سجّل أيام دروسك ومواعيد نزول المحاضرات. هنستخدم البيانات دي بعد كده في التذكيرات والتقرير الأسبوعي.",

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
      "إعداد التذكير هيتحفظ دلوقتي. إرسال Notification حقيقية للجهاز هنعمله في المرحلة التالية.",

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

    eyebrow:
      "Smart Study Assistant",

    title:
      "Lessons & Lecture Schedule",

    subtitle:
      "Save your lesson days and lecture release times. These will later power reminders and your weekly AI report.",

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
      "The reminder preference is saved now. Real browser notifications will be connected in the next phase.",

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

    <Card>

      <h2
        className="mb-5 text-lg font-semibold"
      >

        {
          item
            ? t.edit
            : t.add
        }

      </h2>


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
                  onDone
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

    </Card>
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


  const grouped =
    weekdayOrder.map(
      (
        day,
      ) => ({
        day,

        rows:
          items.filter(
            (
              item,
            ) =>
              item.enabled &&
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

          <p
            className="eyebrow mb-3"
          >
            {
              t.eyebrow
            }
          </p>


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


      <div
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
      >

        <div
          className="grid gap-4"
        >

          {
            items.length ===
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
                          className="surface p-5"
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
                                    className="rounded-2xl border p-4"
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
                                            () =>
                                              setEditing(
                                                item,
                                              )
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


        <div>

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

                router.refresh();
              }
            }
          />

        </div>

      </div>

    </main>
  );
}
