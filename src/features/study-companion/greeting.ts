import { companionCopy } from "./copy";
import type { CompanionContext, Locale } from "./model";

export function automaticGreeting(context: CompanionContext, locale: Locale): string {
  const t = companionCopy[locale];
  const now = Date.parse(context.now);
  if (context.upcoming && Date.parse(context.upcoming.startsAt) > now && Date.parse(context.upcoming.startsAt) - now <= 45 * 60000)
    return t.greetingUpcoming(context.upcoming.title);
  const overdue = context.tasks.filter(task => task.day < context.today).length;
  if (overdue) return t.greetingOverdue(overdue);
  const today = context.tasks.filter(task => task.day === context.today).length;
  if (today) return t.greetingTasks(today);
  if (context.studiedMinutes !== null && context.studiedMinutes >= context.goalMinutes) return t.greetingDone;
  if (context.studiedMinutes === 0) return t.greetingGoal;
  return t.greetingEmpty;
}

export function shouldAutoOpen(configured: boolean, enabled: boolean, greetingEnabled: boolean, greetedThisSession: boolean): boolean {
  return !configured || (enabled && greetingEnabled && !greetedThisSession);
}
