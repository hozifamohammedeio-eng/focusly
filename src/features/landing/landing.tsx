import Link from "next/link";
import { cookies } from "next/headers";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { phase2 } from "@/features/i18n/phase2";
import { LandingControls } from "./controls";
import styles from "./landing.module.css";
import { phase4 } from "@/features/i18n/phase4";

export async function Landing() {
  const locale = (await cookies()).get("focusly-locale")?.value === "ar" ? "ar" : "en";
  const t = phase2[locale];
  const p = phase4[locale];
  const ar = locale === "ar";
  return (
    <div className={styles.page} lang={locale} dir={ar ? "rtl" : "ltr"}>
      <a className="skip-link" href="#main">{ar ? "انتقل للمحتوى" : "Skip to content"}</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} dir="ltr">focusly<span>.</span></Link>
        <nav aria-label={ar ? "التنقل الرئيسي" : "Main navigation"}>
          <a href="#features">{ar ? "المميزات" : "Features"}</a><a href="#how-it-works">{ar ? "بنبدأ إزاي" : "How it works"}</a>
          <LandingControls ar={ar} />
          <Link href="/login">{ar ? "دخول" : "Log in"}</Link><ButtonLink href="/signup">{ar ? "ابدأ دلوقتي" : "Get started"}</ButtonLink>
          <Link href="/app">{ar ? "لوحة التحكم" : "Go to Dashboard"}</Link>
        </nav>
      </header>
      <main id="main" className="landing-page">
        <div className="landing-hero">
          <section className="landing-introduction">
            <p className="eyebrow">{t.built}</p>
            <h1>{ar ? "مذاكرتك منظمة." : "Your study life."}<br /><span className="muted">{ar ? "تركيزك أعلى." : "Beautifully organized."}</span></h1>
            <p className="muted landing-description">{ar ? "نظّم مهامك، خطط لأسبوعك، وحقق أهدافك الدراسية في مكان واحد." : "Plan smarter, stay focused, and turn your study goals into real progress — all in one place."}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/signup" className="min-h-12 px-7">{ar ? "ابدأ مجانًا" : "Get Started Free"}</ButtonLink>
              <a href="#features" className="inline-flex min-h-12 items-center px-6 underline underline-offset-4">{ar ? "اكتشف المميزات" : "Explore features"}</a>
            </div>
          </section>
          <figure className="product-collage" aria-label={t.previewLabel}>
            <Card variant="accent" className="preview-goal">
              <p className="eyebrow">{p.goal}</p>
              <p className="preview-duration display-type"><bdi>{ar ? "١س ٤٥د" : "1h 45m"}</bdi></p>
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
        <section id="features" className={styles.section} aria-labelledby="features-title">
          <p className="eyebrow">{ar ? "تنقّل أقل. مذاكرة أكتر." : "Less switching. More studying."}</p>
          <h2 id="features-title">{ar ? "كل اللي تحتاجه ليوم أكتر تركيزًا." : "Everything for a more focused day."}</h2>
          <div className={styles.features}>{[
            ["Smart Study Planning", "تخطيط ذكي للمذاكرة", "Organize your week yourself or draft a schedule with AI Weekly Planner. Review before saving.", "رتّب أسبوعك بنفسك أو اعمل مسودة بمخطط الأسبوع الذكي. راجعها قبل الحفظ."],
            ["Tasks & Calendar", "المهام والتقويم", "Keep daily tasks, deadlines, and study sessions in one clear view.", "خلّي مهامك وتسليماتك وجلسات المذاكرة قدامك بوضوح."],
            ["Focus Timer", "مؤقت التركيز", "Use Pomodoro or Open Study, take a break, and return with a clear head.", "استخدم بومودورو أو المذاكرة المفتوحة، خد استراحة، وارجع بذهن صافي."],
            ["AI Study Companion", "رفيق المذاكرة الذكي", "Organize tasks, reminders, schedules, and goals through a natural conversation.", "نظّم المهام والتذكيرات والمواعيد والأهداف بكلام طبيعي مع رفيقك."],
            ["Goals & Progress", "الأهداف والتقدّم", "Set a daily goal and see your focus time and study patterns in Statistics.", "حدد هدفك اليومي وتابع وقت تركيزك وعادات مذاكرتك في الإحصائيات."],
            ["Challenges & Your City", "التحديات ومدينتك", "Take on challenges, unlock achievements, and grow your city through study progress.", "شارك في التحديات، افتح إنجازات، وشوف مدينتك بتكبر مع تقدّمك."]
          ].map(([en, arabic, body, arabicBody], i) => <article key={en}><span className={styles.number}>0{i + 1}</span><h3>{ar ? arabic : en}</h3><p>{ar ? arabicBody : body}</p></article>)}</div>
        </section>
        <section id="how-it-works" className={styles.section} aria-labelledby="steps-title">
          <p className="eyebrow">{ar ? "على طريقتك" : "Make it yours"}</p><h2 id="steps-title">{ar ? "بداية جديدة في تلات خطوات." : "A fresh start in three steps."}</h2>
          <ol className={styles.steps}>{[
            ["Create your account", "اعمل حسابك", "Sign up with email and password, then confirm your email.", "سجّل بالإيميل وكلمة السر، وبعدها أكّد إيميلك."],
            ["Find your rhythm", "اختار اللي يناسبك", "Choose subjects, study preferences, daily goals, and your favorite theme.", "اختار موادك وتفضيلاتك وهدفك اليومي والمظهر اللي تحبه."],
            ["Start organizing", "ابدأ رتّب يومك", "Plan tasks, settle into a focus session, and follow your progress.", "خطط لمهامك، ابدأ جلسة تركيز، وتابع تقدّمك."]
          ].map(([en, arabic, body, arabicBody], i) => <li key={en}><span className={styles.number}>0{i + 1}</span><h3>{ar ? arabic : en}</h3><p>{ar ? arabicBody : body}</p></li>)}</ol>
        </section>
        <section className={styles.companion} aria-labelledby="companion-title">
          <div><p className="eyebrow">{ar ? "اتعرّف على رفيق المذاكرة" : "Meet your Study Companion"}</p><h2 id="companion-title">{ar ? "مساعدة بسيطة، في وقتها." : "A little help, right when you need it."}</h2><p>{ar ? "حوّل فكرتك لخطوة مترتبة. رفيقك يساعدك في المهام والتذكيرات والخطط والأهداف جوه Focusly." : "Turn a thought into an organized next step. Your Companion helps with tasks, reminders, plans, and goals across Focusly."}</p></div>
          <figure className={styles.chat}><figcaption>{ar ? "محادثة توضيحية" : "Illustrative conversation"}</figcaption>
            <p className={styles.student}>{ar ? "انقل جلسة البرمجة بتاعة بكرة للساعة ٧ مساءً." : "Move tomorrow’s programming session to 7 PM."}</p>
            <p>{ar ? "تمام 👌 خلينا نتأكد إن الوقت فاضي." : "Sure 👌 Let’s check that the time is free."}</p>
            <p className={styles.student}>{ar ? "وخلي هدفي اليومي ٩٠ دقيقة." : "And set my daily goal to 90 minutes."}</p>
            <p>{ar ? "تمام ✅ هدفك اليومي بقى ٩٠ دقيقة." : "Done ✅ Your daily goal is 90 minutes."}</p>
          </figure>
        </section>
        <section className={styles.final}><h2>{ar ? "جاهز تنظم مذاكرتك؟" : "Ready to make studying feel easier?"}</h2><p>{ar ? "ابدأ بخطوة بسيطة، وخلي كل يوم أقرب لهدفك." : "Build better study habits, one focused day at a time."}</p><ButtonLink href="/signup">{ar ? "ابدأ مع Focusly" : "Start Using Focusly"}</ButtonLink></section>
      </main>
      <footer className={styles.footer}><div><span className={styles.brand} dir="ltr">focusly.</span><p>{ar ? "تخطيط وتركيز وتقدّم. في مكان واحد." : "Study planning, focus, and progress. Together."}</p></div><nav aria-label={ar ? "روابط إضافية" : "Footer"}><Link href="/login">{ar ? "تسجيل الدخول" : "Log in"}</Link><Link href="/signup">{ar ? "إنشاء حساب" : "Create account"}</Link></nav></footer>
    </div>
  );
}
