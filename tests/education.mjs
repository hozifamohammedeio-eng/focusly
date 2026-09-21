import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EMPTY_EDUCATION,
  validEducation,
  suggestions,
  changeEducation,
  label,
} from "../src/features/education/config.ts";
const cases = JSON.parse(
  readFileSync(new URL("./education-cases.json", import.meta.url)),
);
test("all 22 education paths have distinct, translated subject suggestions", () => {
  assert.equal(cases.length, 22);
  for (const e of cases) {
    assert.equal(validEducation(e), true, JSON.stringify(e));
    const list = suggestions(e);
    assert.ok(list.length >= 3 && list.length <= 20);
    assert.equal(new Set(list.map((s) => s.id)).size, list.length);
    for (const s of list) {
      assert.notEqual(label(s.id, "en"), s.id);
      assert.match(label(s.id, "ar"), /[\u0600-\u06ff]/);
    }
    if (e.specialization_subject)
      assert.deepEqual(
        list.filter((s) => s.group === "specialization").map((s) => s.id),
        [e.specialization_subject],
      );
  }
});
test("curriculum content: exact subjects for each secondary path", () => {
  const common = ["arabic", "first_language"];
  const expected = {
    scientific: [...common, "mathematics", "history", "chemistry", "physics"],
    science: [...common, "biology", "chemistry", "physics"],
    mathematics: [...common, "mathematics", "chemistry", "physics"],
  };
  for (const e of cases.filter((e) => e.school_stage === "secondary")) {
    const list = suggestions(e);
    if (e.school_year === "secondary_1")
      assert.deepEqual(
        list.map((s) => s.id),
        [
          ...common,
          "history",
          "mathematics",
          "integrated_science",
          "philosophy_logic",
          "religion",
          "second_language",
          "physical_education",
          "programming_ai",
        ],
      );
    else if (e.education_system === "general_secondary") {
      const main =
        e.academic_branch === "literary"
          ? e.school_year === "secondary_2"
            ? [...common, "history", "geography", "psychology", "mathematics"]
            : [...common, "history", "geography", "statistics"]
          : expected[e.academic_branch];
      assert.deepEqual(
        list.filter((s) => s.group === "total").map((s) => s.id),
        main,
      );
      assert.deepEqual(
        list.filter((s) => s.group === "supporting").map((s) => s.id),
        [
          "religion",
          "second_language",
          "physical_education",
          ...(e.school_year === "secondary_3" ? ["national_education"] : []),
        ],
      );
    } else if (e.school_year === "secondary_2")
      assert.deepEqual(
        list.map((s) => s.id),
        [
          ...common,
          "history",
          e.specialization_subject,
          "financial_literacy",
          "physical_education",
        ],
      );
    else
      assert.deepEqual(
        list.map((s) => s.id),
        {
          medicine_life_sciences: [
            "advanced_biology",
            "advanced_chemistry",
            "religion",
          ],
          engineering_computer_science: [
            "advanced_mathematics",
            "advanced_physics",
            "religion",
          ],
          business: ["advanced_economics", "mathematics", "religion"],
          arts_humanities: ["advanced_geography", "statistics", "religion"],
        }[e.academic_track],
      );
  }
});
test("invalid combinations and dependent resets", () => {
  const e = {
    ...EMPTY_EDUCATION,
    school_stage: "secondary",
    school_year: "secondary_2",
    education_system: "egyptian_baccalaureate",
    academic_track: "engineering_computer_science",
    specialization_subject: "chemistry",
  };
  for (const patch of [
    { school_year: "secondary_1" },
    { education_system: "general_secondary" },
    { academic_branch: "scientific" },
    { specialization_subject: "physics" },
    { school_stage: "bogus" },
    { school_year: "prep_1" },
  ])
    assert.equal(validEducation({ ...e, ...patch }), false);
  assert.deepEqual(changeEducation(e, "school_stage", "preparatory"), {
    ...EMPTY_EDUCATION,
    school_stage: "preparatory",
  });
  for (const [key, value] of [
    ["school_year", "secondary_1"],
    ["education_system", "general_secondary"],
  ]) {
    const next = changeEducation(e, key, value);
    assert.equal(next.academic_track, null);
    assert.equal(next.specialization_subject, null);
    assert.equal(next.academic_branch, null);
  }
  assert.equal(
    changeEducation(e, "academic_track", "business").specialization_subject,
    null,
  );
});
