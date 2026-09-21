"use client";
import { useLocale } from "@/features/i18n/locale-provider";
import {
  BRANCHES,
  ELECTIVES,
  SYSTEMS,
  YEARS,
  changeEducation,
  label,
  type Education,
} from "./config";

export function EducationFields({
  value,
  onChange,
  showStage = true,
}: {
  value: Education;
  onChange: (value: Education) => void;
  showStage?: boolean;
}) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  function select(
    key: keyof Education,
    title: string,
    options: readonly string[],
  ) {
    return (
      <label className="grid gap-2 text-sm font-semibold" key={key}>
        {title}
        <select
          className="field"
          name={key}
          value={value[key] ?? ""}
          required
          onChange={(event) =>
            onChange(changeEducation(value, key, event.target.value))
          }
        >
          <option value="" disabled>
            {ar ? "اختر…" : "Choose…"}
          </option>
          {options.map((id) => (
            <option key={id} value={id}>
              {key === "academic_branch" && id === "mathematics"
                ? ar
                  ? "علمي رياضة"
                  : "Mathematics branch"
                : label(id, locale)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const later =
    value.school_year === "secondary_2" || value.school_year === "secondary_3";
  return (
    <div className="grid gap-5">
      {showStage &&
        select(
          "school_stage",
          ar ? "المرحلة الدراسية" : "Education stage",
          Object.keys(YEARS),
        )}
      {value.school_stage &&
        select(
          "school_year",
          ar ? "السنة الدراسية" : "School year",
          YEARS[value.school_stage],
        )}
      {value.school_stage === "secondary" &&
        value.school_year &&
        select(
          "education_system",
          ar ? "اختر نظام الدراسة" : "Choose your education system",
          SYSTEMS,
        )}
      {later &&
        value.education_system === "general_secondary" &&
        select(
          "academic_branch",
          ar ? "اختر الشعبة" : "Choose your branch",
          BRANCHES[value.school_year as keyof typeof BRANCHES],
        )}
      {later &&
        value.education_system === "egyptian_baccalaureate" &&
        select(
          "academic_track",
          ar ? "اختر المسار" : "Choose your track",
          Object.keys(ELECTIVES),
        )}
      {value.school_year === "secondary_2" &&
        value.education_system === "egyptian_baccalaureate" &&
        value.academic_track &&
        select(
          "specialization_subject",
          ar ? "اختر مادة التخصص" : "Choose your specialization subject",
          ELECTIVES[value.academic_track],
        )}
    </div>
  );
}
