"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  UUID,
  validText,
  validZone,
} from "@/features/planning/logic";


export type ScheduleMutationResult = {
  error?:
    | "invalid"
    | "expired"
    | "saveError"
    | "notFound";

  success?:
    | "saved"
    | "deleted";
};


function field(
  form: FormData,
  key: string,
) {
  return typeof form.get(key) === "string"
    ? String(form.get(key)).trim()
    : "";
}


export async function saveScheduleItem(
  form: FormData,
): Promise<ScheduleMutationResult> {

  try {

    const client = await createClient();

    const {
      data: auth,
      error: authError,
    } = await client.auth.getUser();


    if (authError || !auth.user) {
      return {
        error: "expired",
      };
    }


    const owner = auth.user.id;

    const id = field(form, "id");

    const title = field(
      form,
      "title",
    );

    const kind = field(
      form,
      "kind",
    );

    const weekday = Number(
      field(
        form,
        "weekday",
      ),
    );

    const subjectId =
      field(
        form,
        "subject_id",
      ) || null;


    const timeValue =
      field(
        form,
        "local_time",
      );

    const localTime =
      timeValue || null;


    const zone =
      field(
        form,
        "time_zone",
      );


    const reminderValue =
      field(
        form,
        "remind_before_minutes",
      );


    const reminder =
      reminderValue === ""
        ? null
        : Number(reminderValue);


    const notificationsEnabled =
      field(
        form,
        "notifications_enabled",
      ) === "true";


    if (
      (
        id &&
        !UUID.test(id)
      ) ||

      !validText(
        title,
        200,
      ) ||

      ![
        "lesson",
        "lecture_release",
      ].includes(kind) ||

      !Number.isInteger(
        weekday,
      ) ||

      weekday < 0 ||

      weekday > 6 ||

      (
        localTime !== null &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(
          localTime,
        )
      ) ||

      !validZone(
        zone,
      ) ||

      (
        reminder !== null &&
        (
          !Number.isInteger(
            reminder,
          ) ||

          reminder < 0 ||

          reminder > 10080
        )
      ) ||

      (
        notificationsEnabled &&
        !localTime
      )
    ) {
      return {
        error: "invalid",
      };
    }


    if (subjectId) {

      if (
        !UUID.test(
          subjectId,
        )
      ) {
        return {
          error: "invalid",
        };
      }


      const subject =
        await client
          .from("subjects")
          .select("id")
          .eq(
            "id",
            subjectId,
          )
          .eq(
            "user_id",
            owner,
          )
          .single();


      if (subject.error) {
        return {
          error: "invalid",
        };
      }
    }


    const values = {

      subject_id:
        subjectId,

      title,

      kind:
        kind as
          | "lesson"
          | "lecture_release",

      weekday,

      local_time:
        localTime,

      time_zone:
        zone,

      remind_before_minutes:
        reminder,

      notifications_enabled:
        notificationsEnabled,

      enabled:
        true,

      updated_at:
        new Date().toISOString(),

    };


    const result =
      id

        ? await client
            .from(
              "study_schedule_items",
            )
            .update(
              values,
            )
            .eq(
              "id",
              id,
            )
            .eq(
              "user_id",
              owner,
            )
            .select(
              "id",
            )
            .single()

        : await client
            .from(
              "study_schedule_items",
            )
            .insert({
              ...values,
              user_id:
                owner,
            })
            .select(
              "id",
            )
            .single();


    if (result.error) {

      console.error(
        "schedule_save_failed",
        {
          code:
            result.error.code,
        },
      );

      return {
        error:
          "saveError",
      };
    }


    revalidatePath(
      "/app/schedule",
    );

    revalidatePath(
      "/app",
      "layout",
    );


    return {
      success:
        "saved",
    };

  } catch {

    console.error(
      "schedule_request_failed",
    );

    return {
      error:
        "saveError",
    };
  }
}


export async function deleteScheduleItem(
  id: string,
): Promise<ScheduleMutationResult> {

  if (
    !UUID.test(id)
  ) {
    return {
      error:
        "invalid",
    };
  }


  try {

    const client =
      await createClient();


    const {
      data: auth,
      error: authError,
    } =
      await client.auth.getUser();


    if (
      authError ||
      !auth.user
    ) {
      return {
        error:
          "expired",
      };
    }


    const result =
      await client
        .from(
          "study_schedule_items",
        )
        .delete()
        .eq(
          "id",
          id,
        )
        .eq(
          "user_id",
          auth.user.id,
        )
        .select(
          "id",
        );


    if (
      result.error
    ) {
      return {
        error:
          "saveError",
      };
    }


    if (
      !result.data.length
    ) {
      return {
        error:
          "notFound",
      };
    }


    revalidatePath(
      "/app/schedule",
    );

    revalidatePath(
      "/app",
      "layout",
    );


    return {
      success:
        "deleted",
    };

  } catch {

    return {
      error:
        "saveError",
    };
  }
}
