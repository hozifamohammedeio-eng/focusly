export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type BaseRow = { id: string; created_at: string; updated_at: string };
type OwnedRow = BaseRow & { user_id: string };
type Table<Row, RequiredInsert extends object> = {
  Row: Row;
  Insert: Partial<Row> & RequiredInsert;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          onboarding_step: number;
          onboarding_subjects: string[];
          id: string;
          display_name: string | null;
          school_stage: Database["public"]["Enums"]["school_stage"] | null;
          school_year: Database["public"]["Enums"]["school_year"] | null;
          education_system:
            "general_secondary" | "egyptian_baccalaureate" | null;
          academic_branch:
            "scientific" | "literary" | "science" | "mathematics" | null;
          academic_track:
            | "medicine_life_sciences"
            | "engineering_computer_science"
            | "business"
            | "arts_humanities"
            | null;
          specialization_subject:
            | "physics"
            | "mathematics"
            | "chemistry"
            | "programming_ai"
            | "accounting"
            | "business_administration"
            | "psychology"
            | "second_language"
            | null;
          daily_goal_minutes: number | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        },
        { id: string }
      >;
      user_settings: Table<
        {
          user_id: string;
          locale: Database["public"]["Enums"]["app_locale"];
          theme: Database["public"]["Enums"]["app_theme"];
          accent: Database["public"]["Enums"]["accent_color"];
          focus_minutes: number;
          short_break_minutes: number;
          long_break_minutes: number;
          time_zone: string | null;
          created_at: string;
          updated_at: string;
        },
        { user_id: string }
      >;
      subjects: Table<
        OwnedRow & {
          name: string;
          color: string;
          sort_order: number;
          archived_at: string | null;
        },
        { user_id: string; name: string }
      >;
      tasks: Table<
        OwnedRow & {
          subject_id: string | null;
          title: string;
          notes: string | null;
          status: Database["public"]["Enums"]["task_status"];
          priority: Database["public"]["Enums"]["task_priority"];
          due_at: string | null;
          due_on: string | null;
          estimated_minutes: number | null;
          completed_at: string | null;
        },
        { user_id: string; title: string }
      >;
      study_blocks: Table<
        OwnedRow & {
          subject_id: string | null;
          title: string;
          starts_at: string;
          ends_at: string;
          repeat_weekly: boolean;
          time_zone: string;
          notes: string | null;
        },
        { user_id: string; title: string; starts_at: string; ends_at: string }
      >;
      study_schedule_items: Table<
        OwnedRow & {
          subject_id: string | null;
          title: string;
          kind: "lesson" | "lecture_release";
          weekday: number;
          local_time: string | null;
          time_zone: string;
          remind_before_minutes: number | null;
          notifications_enabled: boolean;
          enabled: boolean;
        },
        {
          user_id: string;
          title: string;
          kind: "lesson" | "lecture_release";
          weekday: number;
          time_zone: string;
        }
      >;
      focus_sessions: Table<
        OwnedRow & {
          subject_id: string | null;
          task_id: string | null;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number;
          completed: boolean;
          timer_state: "running" | "paused" | "completed" | "discarded" | null;
          planned_seconds: number | null;
          accumulated_seconds: number;
          running_since: string | null;
        },
        { user_id: string; started_at: string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      save_education: {
        Args: { p_value: Json; p_subjects?: string[] };
        Returns: undefined;
      };
      focus_transition: {
        Args: {
          p_action: string;
          p_id?: string;
          p_minutes?: number;
          p_subject?: string;
          p_task?: string;
          p_revision?: string;
        };
        Returns: Json;
      };
      focus_progress: { Args: Record<string, never>; Returns: Json };
      claim_study_push_subscription: {
        Args: {
          p_endpoint: string;
          p_p256dh: string;
          p_auth: string;
          p_user_agent: string;
        };
        Returns: undefined;
      };
      remove_subject: { Args: { p_id: string }; Returns: boolean };
      save_onboarding_step: {
        Args: { p_step: number; p_value: Json };
        Returns: undefined;
      };
      complete_onboarding: {
        Args: {
          p_locale: "en" | "ar";
          p_theme: "light" | "dark" | "system";
          p_accent: "violet" | "blue" | "green" | "orange";
        };
        Returns: undefined;
      };
    };
    Enums: {
      school_stage: "preparatory" | "secondary";
      school_year:
        | "prep_1"
        | "prep_2"
        | "prep_3"
        | "secondary_1"
        | "secondary_2"
        | "secondary_3";
      app_locale: "en" | "ar";
      app_theme: "light" | "dark" | "system";
      accent_color: "violet" | "blue" | "green" | "orange";
      task_status: "todo" | "in_progress" | "completed";
      task_priority: "low" | "medium" | "high";
    };
    CompositeTypes: Record<string, never>;
  };
};
