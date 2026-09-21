"use client";
import { SiteHeader } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCopy } from "@/features/i18n/use-copy";
import { useLocale } from "@/features/i18n/locale-provider";
import { phase4 } from "@/features/i18n/phase4";

export function Landing() {
  const t = useCopy();
  const { locale } = useLocale();
  const p = phase4[locale];
  const ar = locale === "ar";
  return (
    <>
      <SiteHeader authLinks />
      <main id="main" className="landing-page">
        <div className="landing-hero">
          <section className="landing-introduction">
            <p className="eyebrow">{t.built}</p>
            <h1>{t.hero1}<br /><span className="muted">{t.hero2}</span></h1>
            <p className="muted landing-description">{t.heroText}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/signup" className="min-h-12 px-7">{t.getStarted}</ButtonLink>
              <ButtonLink href="/login" variant="ghost" className="min-h-12 px-6">{t.login}<span aria-hidden="true">{ar ? "←" : "→"}</span></ButtonLink>
            </div>
          </section>
          <figure className="product-collage" aria-label={t.previewLabel}>
            <Card variant="accent" className="preview-goal">
              <p className="eyebrow">{p.goal}</p>
              <p className="preview-duration display-type"><bdi>1h 45m</bdi></p>
              <p>{ar ? "من هدف ٣ ساعات" : "of a 3 hour goal"}</p>
              <div className="preview-track" aria-hidden="true"><span /></div>
              <p className="mt-5 text-sm">{t.intentText}</p>
            </Card>
            <Card variant="floating" className="preview-focus">
              <p className="eyebrow">{p.focus}</p>
              <p className="quick-digits" dir="ltr">25:00</p>
              <p className="muted text-sm">{t.subjectNames.Mathematics}</p>
              <span className="preview-pill" aria-hidden="true">{p.startSession}</span>
            </Card>
            <Card variant="floating" className="preview-tasks">
              <p className="mb-4 text-sm font-medium">{p.todayTasks}</p>
              <div className="preview-task"><span aria-hidden="true">✓</span><span>{ar ? "مراجعة الجبر" : "Review algebra"}</span></div>
              <div className="preview-task"><span aria-hidden="true">○</span><span>{ar ? "قراءة الفصل التالي" : "Read the next chapter"}</span></div>
            </Card>
            <figcaption className="muted">{ar ? "لمحة توضيحية عن مساحة دراستك" : "An illustrative look at your study space"}</figcaption>
          </figure>
        </div>
        <section className="landing-note">
          <div><p className="eyebrow">{t.intent}</p><h2 className="display-type">{t.preview}</h2></div>
          <p className="muted">{t.previewNote}</p>
        </section>
      </main>
      <footer className="landing-footer muted">{t.footer}<span dir="ltr">focusly.</span></footer>
    </>
  );
}
