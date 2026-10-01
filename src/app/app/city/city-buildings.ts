import type { BuildingKey } from "@/features/city/domain";

export const buildings: ReadonlyArray<{ key: BuildingKey; x: number; y: number }> = [
  { key: "knowledge_center", x: 50, y: 30 },
  { key: "focus_tower", x: 20, y: 30 },
  { key: "library_district", x: 80, y: 30 },
  { key: "science_lab", x: 20, y: 73 },
  { key: "language_academy", x: 80, y: 73 },
  { key: "planner_hall", x: 50, y: 73 },
];
