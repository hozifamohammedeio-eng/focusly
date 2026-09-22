// Product curriculum supplied for Egypt. Stable IDs are persisted; labels are display only.
export const YEARS = {
  preparatory: ["prep_1", "prep_2", "prep_3"],
  secondary: ["secondary_1", "secondary_2", "secondary_3"],
} as const;
export type Stage = keyof typeof YEARS;
export type Year = (typeof YEARS)[Stage][number];
export const SYSTEMS = ["general_secondary", "egyptian_baccalaureate"] as const;
export type System = (typeof SYSTEMS)[number];
export const BRANCHES = {
  secondary_2: ["scientific", "literary"],
  secondary_3: ["science", "mathematics", "literary"],
} as const;
export type Branch = "scientific" | "literary" | "science" | "mathematics";
export const ELECTIVES = {
  medicine_life_sciences: ["physics", "mathematics"],
  engineering_computer_science: ["chemistry", "programming_ai"],
  business: ["accounting", "business_administration"],
  arts_humanities: ["psychology", "second_language"],
} as const;
export type Track = keyof typeof ELECTIVES;
export type Specialization = (typeof ELECTIVES)[Track][number];
export type Education = {
  school_stage: Stage | null;
  school_year: Year | null;
  education_system: System | null;
  academic_branch: Branch | null;
  academic_track: Track | null;
  specialization_subject: Specialization | null;
};
export const EMPTY_EDUCATION: Education = {
  school_stage: null,
  school_year: null,
  education_system: null,
  academic_branch: null,
  academic_track: null,
  specialization_subject: null,
};
export { LABELS } from "./labels.ts";
import { LABELS } from "./labels.ts";
export const label = (id: string, locale: "en" | "ar") =>
  LABELS[id]?.[locale === "ar" ? 1 : 0] ?? id;
export type SubjectSuggestion = {
  id: string;
  group: "total" | "supporting" | "specialization" | "advanced";
};
const common = ["arabic", "first_language"];
const supporting = ["religion", "second_language", "physical_education"];
const general = {
  scientific: [...common, "mathematics", "history", "chemistry", "physics"],
  literary2: [...common, "history", "geography", "psychology", "mathematics"],
  science: [...common, "biology", "chemistry", "physics"],
  mathematics: [...common, "mathematics", "chemistry", "physics"],
  literary3: [...common, "history", "geography", "statistics"],
};
const advanced = {
  medicine_life_sciences: ["advanced_biology", "advanced_chemistry"],
  engineering_computer_science: ["advanced_mathematics", "advanced_physics"],
  business: ["advanced_economics", "mathematics"],
  arts_humanities: ["advanced_geography", "statistics"],
};
export function validEducation(e: Education): boolean {
  if (
    !e.school_stage ||
    !Object.hasOwn(YEARS, e.school_stage) ||
    !e.school_year ||
    !(YEARS[e.school_stage] as readonly string[]).includes(e.school_year)
  )
    return false;
  if (e.school_stage === "preparatory")
    return (
      !e.education_system &&
      !e.academic_branch &&
      !e.academic_track &&
      !e.specialization_subject
    );
  if (!e.education_system || !SYSTEMS.includes(e.education_system))
    return false;
  if (e.school_year === "secondary_1")
    return !e.academic_branch && !e.academic_track && !e.specialization_subject;
  if (e.education_system === "general_secondary")
    return (
      !e.academic_track &&
      !e.specialization_subject &&
      !!e.academic_branch &&
      (
        BRANCHES[e.school_year as keyof typeof BRANCHES] as readonly string[]
      ).includes(e.academic_branch)
    );
  if (
    e.academic_branch ||
    !e.academic_track ||
    !Object.hasOwn(ELECTIVES, e.academic_track)
  )
    return false;
  return e.school_year === "secondary_3"
    ? !e.specialization_subject
    : !!e.specialization_subject &&
        (ELECTIVES[e.academic_track] as readonly string[]).includes(
          e.specialization_subject,
        );
}
export function educationFrom(
  value: Partial<Record<keyof Education, unknown>>,
): Education {
  return Object.fromEntries(
    Object.keys(EMPTY_EDUCATION).map((key) => [
      key,
      typeof value[key as keyof Education] === "string"
        ? value[key as keyof Education] || null
        : null,
    ]),
  ) as Education;
}
export function changeEducation(
  e: Education,
  key: keyof Education,
  value: string,
): Education {
  const next = { ...e, [key]: value || null };
  if (key === "school_stage")
    return { ...EMPTY_EDUCATION, school_stage: next.school_stage };
  if (key === "school_year" || key === "education_system")
    return {
      ...next,
      education_system:
        next.school_stage === "secondary" ? next.education_system : null,
      academic_branch: null,
      academic_track: null,
      specialization_subject: null,
    };
  if (key === "academic_track") next.specialization_subject = null;
  return next;
}
export function suggestions(e: Education): SubjectSuggestion[] {
  if (!validEducation(e)) return [];
  const group = (
    ids: readonly string[],
    kind: SubjectSuggestion["group"],
  ): SubjectSuggestion[] => ids.map((id) => ({ id, group: kind }));
  if (e.school_stage === "preparatory")
    return group(
      [...common, "mathematics", "science_subject", "social_studies"],
      "total",
    );
  if (e.school_year === "secondary_1")
    return [
      ...group(
        [
          ...common,
          "history",
          "mathematics",
          "integrated_science",
          "philosophy_logic",
        ],
        "total",
      ),
      ...group([...supporting, "programming_ai"], "supporting"),
    ];
  if (e.education_system === "general_secondary") {
    const key =
      e.academic_branch === "literary"
        ? e.school_year === "secondary_2"
          ? "literary2"
          : "literary3"
        : (e.academic_branch as "scientific" | "science" | "mathematics");
    return [
      ...group(general[key], "total"),
      ...group(
        e.school_year === "secondary_3"
          ? [...supporting, "national_education"]
          : supporting,
        "supporting",
      ),
    ];
  }
  if (e.school_year === "secondary_2")
    return [
      ...group([...common, "history"], "total"),
      ...group([e.specialization_subject!], "specialization"),
      ...group(["financial_literacy", "physical_education"], "supporting"),
    ];
  return [
    ...advanced[e.academic_track!].map((id) => ({
      id,
      group: id.startsWith("advanced_")
        ? ("advanced" as const)
        : ("total" as const),
    })),
    ...group(["religion"], "supporting"),
  ];
}
