import type { BuildingKey } from "@/features/city/domain";

export const buildings: ReadonlyArray<{ key: BuildingKey; x: number; y: number }> = [
  { key: "knowledge_center", x: 50, y: 47 },
  { key: "focus_tower", x: 22, y: 20 },
  { key: "library_district", x: 78, y: 20 },
  { key: "science_lab", x: 20, y: 72 },
  { key: "language_academy", x: 80, y: 72 },
  { key: "planner_hall", x: 50, y: 86 },
];
