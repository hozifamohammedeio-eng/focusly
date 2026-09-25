import {
  createClient,
} from "@/lib/supabase/server";

import {
  planningData,
} from "@/features/planning/data";

import {
  ScheduleManager,
} from "@/features/schedule/schedule-manager";

import {
  PushNotifications,
} from "@/features/schedule/push-notifications";


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
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <PushNotifications
            locale={
              data.settings.locale
            }
          />
        </div>
      </div>

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
    </>
  );
}