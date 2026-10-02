import {
  createClient,
} from "@/lib/supabase/server";

import {
  planningData,
} from "@/features/planning/data";

import {
  ScheduleManager,
} from "@/features/schedule/schedule-manager";



export default async function Page() {

  const data =
    await planningData(
      "subjects",
    );


  const client =
    await createClient();


  const {
    data: items,
    error,
  } =
    await client
      .from(
        "study_schedule_items",
      )
      .select(
        "*",
      )
      .order(
        "weekday",
      )
      .order(
        "local_time",
      );


  if (
    error
  ) {

    throw new Error(
      "Study schedule unavailable",
    );
  }


  return (
      <ScheduleManager
        items={
          items
        }
        subjects={
          data.subjects
        }
        zone={
          data.settings.time_zone ||
          "UTC"
        }
        locale={
          data.settings.locale
        }
      />
  );
}
