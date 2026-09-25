"use client";

import {
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type Locale = "ar" | "en";

type DayMetric = {
  date: string;
  minutes: number;
};

type SubjectMetric = {
  name: string;
  minutes: number;
  percent: number;
};

type ReportMetrics = {
  total_minutes?: number;
  previous_minutes?: number;
  change_minutes?: number;
  change_percent?: number | null;
  focus_sessions?: number;
  completed_tasks?: number;
  active_days?: number;
  weekly_goal_minutes?: number;
  goal_achievement_percent?: number;
  best_day?: DayMetric | null;
  least_day?: DayMetric | null;
  subjects?: SubjectMetric[];
};

type GeneratedReport = {
  headline?: string;
  summary?: string;
  highlights?: string[];
  attention?: string[];
  next_week?: string[];
  guardian_note?: string;
  metrics?: ReportMetrics;
};

type ReportRow = {
  id?: string;
  generated_at?: string;
  period_start?: string;
  period_end?: string;
  report?: GeneratedReport;
};

type FunctionResponse = {
  cached?: boolean;
  report?: ReportRow;
  error?: string;
};

function formatMinutes(
  minutes: number | undefined,
  ar: boolean,
) {
  const value = minutes ?? 0;

  const hours = Math.floor(value / 60);
  const mins = value % 60;

  if (hours === 0) {
    return ar
      ? `${mins} دقيقة`
      : `${mins} min`;
  }

  if (mins === 0) {
    return ar
      ? `${hours} س`
      : `${hours}h`;
  }

  return ar
    ? `${hours} س ${mins} د`
    : `${hours}h ${mins}m`;
}

function formatDate(
  date: string | undefined,
  ar: boolean,
) {
  if (!date) return "—";

  const parsed =
    new Date(`${date}T12:00:00`);

  return new Intl.DateTimeFormat(
    ar ? "ar-EG" : "en-US",
    {
      weekday: "long",
      day: "numeric",
      month: "short",
    },
  ).format(parsed);
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] p-4">
      <p className="text-xs text-[var(--text-secondary)]">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold">
        {value}
      </p>

      {note ? (
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function ReportList({
  title,
  items,
}: {
  title: string;
  items: string[] | undefined;
}) {
  if (!items?.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] p-4">
      <h3 className="mb-3 font-semibold">
        {title}
      </h3>

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={`${index}-${item}`}
            className="flex gap-3 text-sm leading-6 text-[var(--text-secondary)]"
          >
            <span
              aria-hidden="true"
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
            />

            <span>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SubjectDistribution({
  subjects,
  ar,
}: {
  subjects: SubjectMetric[] | undefined;
  ar: boolean;
}) {
  if (!subjects?.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] p-5">
      <h3 className="font-semibold">
        {ar
          ? "توزيع وقت المذاكرة"
          : "Study time distribution"}
      </h3>

      <div className="mt-5 space-y-4">
        {subjects.map((subject) => (
          <div key={subject.name}>
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
              <span className="font-medium">
                {subject.name}
              </span>

              <span className="text-[var(--text-secondary)]">
                {subject.percent}% ·{" "}
                {formatMinutes(
                  subject.minutes,
                  ar,
                )}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      subject.percent,
                    ),
                  )}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PdfList({
  title,
  items,
}: {
  title: string;
  items: string[] | undefined;
}) {
  if (!items?.length) {
    return null;
  }

  return (
    <section
      style={{
        border:
          "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "18px",
        marginTop: "16px",
      }}
    >
      <h3
        style={{
          margin: "0 0 12px",
          fontSize: "18px",
          fontWeight: 700,
        }}
      >
        {title}
      </h3>

      <ul
        style={{
          margin: 0,
          paddingInlineStart: "22px",
        }}
      >
        {items.map(
          (item, index) => (
            <li
              key={`${index}-${item}`}
              style={{
                marginBottom: "8px",
                lineHeight: 1.7,
                fontSize: "14px",
              }}
            >
              {item}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function PdfReport({
  content,
  ar,
  generatedAt,
}: {
  content: GeneratedReport;
  ar: boolean;
  generatedAt: string | undefined;
}) {
  const metrics = content.metrics;

  const generatedLabel =
    generatedAt
      ? new Intl.DateTimeFormat(
          ar ? "ar-EG" : "en-US",
          {
            dateStyle: "medium",
            timeStyle: "short",
          },
        ).format(
          new Date(generatedAt),
        )
      : "";

  const change =
    metrics?.change_minutes ?? 0;

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        width: "794px",
        backgroundColor: "#ffffff",
        color: "#111827",
        padding: "42px",
        fontFamily:
          "Arial, Tahoma, sans-serif",
        lineHeight: 1.6,
      }}
    >
      <div
        style={{
          borderBottom:
            "2px solid #111827",
          paddingBottom: "20px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            fontSize: "15px",
            fontWeight: 700,
            marginBottom: "6px",
          }}
        >
          FOCUSLY
        </div>

        <h1
          style={{
            fontSize: "30px",
            margin: "0 0 8px",
          }}
        >
          {ar
            ? "التقرير الأسبوعي للمذاكرة"
            : "Weekly Study Report"}
        </h1>

        {generatedLabel ? (
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            {ar
              ? `تم إنشاء التقرير: ${generatedLabel}`
              : `Generated: ${generatedLabel}`}
          </p>
        ) : null}
      </div>

      <section
        style={{
          border:
            "1px solid #e5e7eb",
          borderRadius: "16px",
          padding: "20px",
        }}
      >
        <h2
          style={{
            margin: "0 0 10px",
            fontSize: "24px",
          }}
        >
          {content.headline ||
            (ar
              ? "ملخص الأسبوع"
              : "Weekly summary")}
        </h2>

        {content.summary ? (
          <p
            style={{
              margin: 0,
              color: "#374151",
              fontSize: "15px",
            }}
          >
            {content.summary}
          </p>
        ) : null}
      </section>

      {metrics ? (
        <>
          <h2
            style={{
              margin:
                "28px 0 12px",
              fontSize: "20px",
            }}
          >
            {ar
              ? "أرقام الأسبوع"
              : "This week at a glance"}
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: "12px",
            }}
          >
            <PdfMetric
              label={
                ar
                  ? "إجمالي المذاكرة"
                  : "Study time"
              }
              value={formatMinutes(
                metrics.total_minutes,
                ar,
              )}
            />

            <PdfMetric
              label={
                ar
                  ? "تحقيق الهدف الأسبوعي"
                  : "Weekly goal"
              }
              value={`${metrics.goal_achievement_percent ?? 0}%`}
            />

            <PdfMetric
              label={
                ar
                  ? "أيام المذاكرة"
                  : "Active study days"
              }
              value={`${metrics.active_days ?? 0} / 7`}
            />

            <PdfMetric
              label={
                ar
                  ? "المهام المكتملة"
                  : "Completed tasks"
              }
              value={`${metrics.completed_tasks ?? 0}`}
            />

            <PdfMetric
              label={
                ar
                  ? "جلسات التركيز"
                  : "Focus sessions"
              }
              value={`${metrics.focus_sessions ?? 0}`}
            />

            <PdfMetric
              label={
                ar
                  ? "مقارنة بالأسبوع السابق"
                  : "Vs previous week"
              }
              value={
                change > 0
                  ? `+${formatMinutes(
                      change,
                      ar,
                    )}`
                  : change < 0
                    ? `-${formatMinutes(
                        Math.abs(change),
                        ar,
                      )}`
                    : ar
                      ? "بدون تغيير"
                      : "No change"
              }
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: "12px",
              marginTop: "12px",
            }}
          >
            <PdfMetric
              label={
                ar
                  ? "أعلى يوم مذاكرة"
                  : "Strongest study day"
              }
              value={formatDate(
                metrics.best_day?.date,
                ar,
              )}
              note={formatMinutes(
                metrics.best_day
                  ?.minutes,
                ar,
              )}
            />

            <PdfMetric
              label={
                ar
                  ? "أقل يوم مذاكرة"
                  : "Lowest study day"
              }
              value={formatDate(
                metrics.least_day?.date,
                ar,
              )}
              note={formatMinutes(
                metrics.least_day
                  ?.minutes,
                ar,
              )}
            />
          </div>

          {metrics.subjects?.length ? (
            <section
              style={{
                marginTop: "20px",
                border:
                  "1px solid #e5e7eb",
                borderRadius: "16px",
                padding: "18px",
              }}
            >
              <h3
                style={{
                  margin:
                    "0 0 16px",
                  fontSize: "18px",
                }}
              >
                {ar
                  ? "توزيع وقت المذاكرة"
                  : "Study time distribution"}
              </h3>

              {metrics.subjects.map(
                (subject) => (
                  <div
                    key={
                      subject.name
                    }
                    style={{
                      marginBottom:
                        "14px",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: "20px",
                        fontSize:
                          "14px",
                        marginBottom:
                          "6px",
                      }}
                    >
                      <strong>
                        {
                          subject.name
                        }
                      </strong>

                      <span>
                        {
                          subject.percent
                        }
                        % ·{" "}
                        {formatMinutes(
                          subject.minutes,
                          ar,
                        )}
                      </span>
                    </div>

                    <div
                      style={{
                        height: "8px",
                        borderRadius:
                          "999px",
                        backgroundColor:
                          "#e5e7eb",
                        overflow:
                          "hidden",
                      }}
                    >
                      <div
                        style={{
                          height:
                            "100%",
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              subject.percent,
                            ),
                          )}%`,
                          backgroundColor:
                            "#4f46e5",
                          borderRadius:
                            "999px",
                        }}
                      />
                    </div>
                  </div>
                ),
              )}
            </section>
          ) : null}
        </>
      ) : null}

      <PdfList
        title={
          ar
            ? "أبرز نقاط الأسبوع"
            : "Weekly highlights"
        }
        items={content.highlights}
      />

      <PdfList
        title={
          ar
            ? "نقاط تحتاج انتباه"
            : "Areas to watch"
        }
        items={content.attention}
      />

      <PdfList
        title={
          ar
            ? "اقتراحات الأسبوع القادم"
            : "Next week"
        }
        items={content.next_week}
      />

      {content.guardian_note ? (
        <section
          style={{
            marginTop: "16px",
            border:
              "1px solid #e5e7eb",
            borderRadius: "16px",
            padding: "18px",
          }}
        >
          <h3
            style={{
              margin: "0 0 10px",
              fontSize: "18px",
            }}
          >
            {ar
              ? "ملخص لولي الأمر"
              : "Guardian summary"}
          </h3>

          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "#374151",
            }}
          >
            {
              content.guardian_note
            }
          </p>
        </section>
      ) : null}

      <p
        style={{
          marginTop: "28px",
          paddingTop: "16px",
          borderTop:
            "1px solid #e5e7eb",
          fontSize: "11px",
          color: "#6b7280",
        }}
      >
        {ar
          ? "يعتمد هذا التقرير على بيانات المذاكرة المسجّلة داخل Focusly فقط، ولا يُستخدم لتقييم ذكاء الطالب أو مقارنته بطلاب آخرين."
          : "This report is based only on study activity recorded in Focusly. It does not assess intelligence or compare the student with others."}
      </p>
    </div>
  );
}

function PdfMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div
      style={{
        border:
          "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "16px",
      }}
    >
      <div
        style={{
          color: "#6b7280",
          fontSize: "12px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "6px",
          fontSize: "20px",
          fontWeight: 700,
        }}
      >
        {value}
      </div>

      {note ? (
        <div
          style={{
            marginTop: "4px",
            color: "#6b7280",
            fontSize: "12px",
          }}
        >
          {note}
        </div>
      ) : null}
    </div>
  );
}

export function WeeklyAiReport({
  locale,
}: {
  locale: Locale;
}) {
  const client = createClient();

  const pdfRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const [report, setReport] =
    useState<ReportRow | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [
    downloading,
    setDownloading,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [cached, setCached] =
    useState(false);

  const ar = locale === "ar";

  async function generateReport() {
    setLoading(true);
    setError(null);

    try {
      const {
        data,
        error: functionError,
      } =
        await client.functions.invoke<FunctionResponse>(
          "generate-weekly-report",
          {
            body: {
              force: true,
            },
          },
        );

      if (functionError) {
        throw functionError;
      }

      if (!data?.report) {
        throw new Error(
          data?.error ||
            "Report generation failed",
        );
      }

      setReport(data.report);
      setCached(
        Boolean(data.cached),
      );
    } catch (caught) {
      console.error(
        "Weekly report error",
        caught,
      );

      setError(
        ar
          ? "تعذر إنشاء التقرير الآن. حاول مرة أخرى بعد قليل."
          : "The report could not be generated right now. Please try again shortly.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (
      !pdfRef.current ||
      !report?.report
    ) {
      return;
    }

    setDownloading(true);
    setError(null);

    try {
      const [
        html2canvasModule,
        jsPdfModule,
      ] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const html2canvas =
        html2canvasModule.default;

      const { jsPDF } =
        jsPdfModule;

      const canvas =
        await html2canvas(
          pdfRef.current,
          {
            scale: 2,
            useCORS: true,
            backgroundColor:
              "#ffffff",
            logging: false,
          },
        );

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const margin = 8;

      const printableWidth =
        pageWidth - margin * 2;

      const printableHeight =
        pageHeight - margin * 2;

      const pixelsPerMm =
        canvas.width /
        printableWidth;

      const pageHeightPixels =
        Math.floor(
          printableHeight *
            pixelsPerMm,
        );

      let currentY = 0;
      let pageIndex = 0;

      while (
        currentY < canvas.height
      ) {
        const sliceHeight =
          Math.min(
            pageHeightPixels,
            canvas.height -
              currentY,
          );

        const pageCanvas =
          document.createElement(
            "canvas",
          );

        pageCanvas.width =
          canvas.width;

        pageCanvas.height =
          sliceHeight;

        const context =
          pageCanvas.getContext(
            "2d",
          );

        if (!context) {
          throw new Error(
            "PDF canvas unavailable",
          );
        }

        context.fillStyle =
          "#ffffff";

        context.fillRect(
          0,
          0,
          pageCanvas.width,
          pageCanvas.height,
        );

        context.drawImage(
          canvas,
          0,
          currentY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        );

        const image =
          pageCanvas.toDataURL(
            "image/jpeg",
            0.96,
          );

        const imageHeightMm =
          sliceHeight /
          pixelsPerMm;

        if (pageIndex > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          image,
          "JPEG",
          margin,
          margin,
          printableWidth,
          imageHeightMm,
        );

        currentY += sliceHeight;
        pageIndex += 1;
      }

      const date =
        new Date()
          .toISOString()
          .slice(0, 10);

      pdf.save(
        `Focusly-weekly-report-${date}.pdf`,
      );
    } catch (caught) {
      console.error(
        "PDF download error",
        caught,
      );

      setError(
        ar
          ? "تعذر إنشاء ملف PDF. حاول مرة أخرى."
          : "The PDF could not be created. Please try again.",
      );
    } finally {
      setDownloading(false);
    }
  }

  const content =
    report?.report;

  const metrics =
    content?.metrics;

  const generatedLabel =
    report?.generated_at
      ? new Intl.DateTimeFormat(
          ar
            ? "ar-EG"
            : "en-US",
          {
            dateStyle: "medium",
            timeStyle: "short",
          },
        ).format(
          new Date(
            report.generated_at,
          ),
        )
      : null;

  const changeMinutes =
    metrics?.change_minutes ?? 0;

  const changeLabel =
    changeMinutes > 0
      ? ar
        ? `+${changeMinutes} دقيقة`
        : `+${changeMinutes} min`
      : changeMinutes < 0
        ? ar
          ? `${changeMinutes} دقيقة`
          : `${changeMinutes} min`
        : ar
          ? "بدون تغيير"
          : "No change";

  return (
    <>
      <section
        dir={ar ? "rtl" : "ltr"}
        className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--accent)]">
              {ar
                ? "تقرير Focusly الأسبوعي"
                : "Focusly Weekly Report"}
            </p>

            <h2 className="text-xl font-semibold sm:text-2xl">
              {ar
                ? "تحليل أسبوع الدراسة"
                : "Weekly study analysis"}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              {ar
                ? "تحليل مبني على نشاط المذاكرة المسجّل داخل Focusly خلال آخر 7 أيام، ومصمم ليكون واضحًا للطالب وولي الأمر."
                : "An analysis based on the last 7 days of study activity recorded in Focusly, designed to be useful for both students and guardians."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {content ? (
              <button
                type="button"
                onClick={
                  downloadPdf
                }
                disabled={
                  downloading ||
                  loading
                }
                className="min-h-11 rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-semibold transition hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {downloading
                  ? ar
                    ? "جاري تجهيز PDF..."
                    : "Preparing PDF..."
                  : ar
                    ? "تنزيل PDF"
                    : "Download PDF"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={
                generateReport
              }
              disabled={
                loading ||
                downloading
              }
              className="min-h-11 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? ar
                  ? "جاري التحليل..."
                  : "Analyzing..."
                : report
                  ? ar
                    ? "تحديث التقرير"
                    : "Refresh report"
                  : ar
                    ? "إنشاء التقرير الأسبوعي"
                    : "Generate weekly report"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-xs leading-5 text-[var(--text-secondary)]">
          {ar
            ? "يعتمد التقرير فقط على البيانات المسجّلة داخل Focusly، ولا يقيّم ذكاء الطالب أو قدراته الشخصية ولا يقارنه بطلاب آخرين."
            : "This report only uses activity recorded in Focusly. It does not assess intelligence or personal ability and does not compare the student with others."}
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-[var(--border)] p-4 text-sm"
          >
            {error}
          </div>
        ) : null}

        {content ? (
          <div className="mt-6 space-y-5">
            <section className="rounded-2xl border border-[var(--border)] p-5">
              <div className="flex flex-wrap items-center gap-2">
                {cached ? (
                  <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                    {ar
                      ? "تقرير محفوظ"
                      : "Saved report"}
                  </span>
                ) : null}

                {generatedLabel ? (
                  <span className="text-xs text-[var(--text-secondary)]">
                    {ar
                      ? `تم الإنشاء: ${generatedLabel}`
                      : `Generated: ${generatedLabel}`}
                  </span>
                ) : null}
              </div>

              <h3 className="mt-4 text-xl font-semibold">
                {content.headline ||
                  (ar
                    ? "ملخص الأسبوع"
                    : "Weekly summary")}
              </h3>

              {content.summary ? (
                <p className="mt-3 leading-7 text-[var(--text-secondary)]">
                  {
                    content.summary
                  }
                </p>
              ) : null}
            </section>

            {metrics ? (
              <>
                <section>
                  <p className="mb-3 text-sm font-medium">
                    {ar
                      ? "أرقام الأسبوع"
                      : "This week at a glance"}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                      label={
                        ar
                          ? "إجمالي المذاكرة"
                          : "Study time"
                      }
                      value={formatMinutes(
                        metrics.total_minutes,
                        ar,
                      )}
                      note={
                        ar
                          ? `مقارنة بالأسبوع السابق: ${changeLabel}`
                          : `Vs previous week: ${changeLabel}`
                      }
                    />

                    <MetricCard
                      label={
                        ar
                          ? "تحقيق الهدف الأسبوعي"
                          : "Weekly goal"
                      }
                      value={`${metrics.goal_achievement_percent ?? 0}%`}
                      note={
                        ar
                          ? `الهدف: ${formatMinutes(
                              metrics.weekly_goal_minutes,
                              ar,
                            )}`
                          : `Goal: ${formatMinutes(
                              metrics.weekly_goal_minutes,
                              ar,
                            )}`
                      }
                    />

                    <MetricCard
                      label={
                        ar
                          ? "أيام المذاكرة"
                          : "Active study days"
                      }
                      value={`${metrics.active_days ?? 0} / 7`}
                    />

                    <MetricCard
                      label={
                        ar
                          ? "المهام المكتملة"
                          : "Completed tasks"
                      }
                      value={`${metrics.completed_tasks ?? 0}`}
                      note={
                        ar
                          ? `${metrics.focus_sessions ?? 0} جلسة تركيز`
                          : `${metrics.focus_sessions ?? 0} focus sessions`
                      }
                    />
                  </div>
                </section>

                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="rounded-2xl border border-[var(--border)] p-5">
                    <p className="text-sm text-[var(--text-secondary)]">
                      {ar
                        ? "أعلى يوم مذاكرة"
                        : "Strongest study day"}
                    </p>

                    <p className="mt-2 text-lg font-semibold">
                      {formatDate(
                        metrics.best_day
                          ?.date,
                        ar,
                      )}
                    </p>

                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {formatMinutes(
                        metrics.best_day
                          ?.minutes,
                        ar,
                      )}
                    </p>
                  </section>

                  <section className="rounded-2xl border border-[var(--border)] p-5">
                    <p className="text-sm text-[var(--text-secondary)]">
                      {ar
                        ? "أقل يوم مذاكرة"
                        : "Lowest study day"}
                    </p>

                    <p className="mt-2 text-lg font-semibold">
                      {formatDate(
                        metrics.least_day
                          ?.date,
                        ar,
                      )}
                    </p>

                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {formatMinutes(
                        metrics.least_day
                          ?.minutes,
                        ar,
                      )}
                    </p>
                  </section>
                </div>

                <SubjectDistribution
                  subjects={
                    metrics.subjects
                  }
                  ar={ar}
                />
              </>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-2">
              <ReportList
                title={
                  ar
                    ? "أبرز نقاط الأسبوع"
                    : "Weekly highlights"
                }
                items={
                  content.highlights
                }
              />

              <ReportList
                title={
                  ar
                    ? "نقاط تحتاج انتباه"
                    : "Areas to watch"
                }
                items={
                  content.attention
                }
              />
            </div>

            <ReportList
              title={
                ar
                  ? "اقتراحات الأسبوع القادم"
                  : "Next week"
              }
              items={
                content.next_week
              }
            />

            {content.guardian_note ? (
              <section className="rounded-2xl border border-[var(--border)] p-5">
                <p className="mb-2 text-sm font-medium text-[var(--accent)]">
                  {ar
                    ? "ملخص لولي الأمر"
                    : "Guardian summary"}
                </p>

                <p className="leading-7 text-[var(--text-secondary)]">
                  {
                    content.guardian_note
                  }
                </p>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] px-5 py-8 text-center">
            <p className="font-medium">
              {ar
                ? "لسه مفيش تقرير أسبوعي."
                : "No weekly report yet."}
            </p>

            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {ar
                ? "اضغط إنشاء التقرير لتحليل آخر 7 أيام من المذاكرة."
                : "Generate a report to analyze the last 7 days of study activity."}
            </p>
          </div>
        )}
      </section>

      {content ? (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-10000px",
            top: 0,
            zIndex: -1,
            pointerEvents: "none",
          }}
        >
          <div ref={pdfRef}>
            <PdfReport
              content={content}
              ar={ar}
              generatedAt={
                report?.generated_at
              }
            />
          </div>
        </div>
      ) : null}
    </>
  );
}