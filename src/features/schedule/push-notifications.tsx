"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { VAPID_PUBLIC_KEY } from "@/features/schedule/push-config";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4,
  );

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((character) =>
      character.charCodeAt(0),
    ),
  );
}

export function PushNotifications({
  locale,
}: {
  locale: "ar" | "en";
}) {
  const [permission, setPermission] =
    useState<NotificationPermission | "unsupported">(
      "default",
    );

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);

  const isArabic = locale === "ar";

  useEffect(() => {
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      const timer =
        window.setTimeout(
          () => {
            setPermission(
              "unsupported",
            );
          },
          0,
        );

      return () => {
        window.clearTimeout(
          timer,
        );
      };
    }

    const timer =
      window.setTimeout(
        () => {
          setPermission(
            Notification.permission,
          );
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, []);

  async function enableNotifications() {
    setLoading(true);
    setMessage("");

    try {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setPermission("unsupported");

        throw new Error(
          "Web Push is not supported by this browser.",
        );
      }

      let notificationPermission =
        Notification.permission;

      if (notificationPermission !== "granted") {
        notificationPermission =
          await Notification.requestPermission();
      }

      setPermission(notificationPermission);

      if (notificationPermission !== "granted") {
        throw new Error(
          isArabic
            ? "لم يتم السماح بالإشعارات من المتصفح."
            : "Notification permission was not granted.",
        );
      }

      const registration =
        await navigator.serviceWorker.register(
          "/sw.js",
        );

      await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToUint8Array(
                VAPID_PUBLIC_KEY,
              ),
          });
      }

      const json = subscription.toJSON();

      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;

      if (!p256dh) {
        throw new Error(
          "Push subscription is missing p256dh.",
        );
      }

      if (!auth) {
        throw new Error(
          "Push subscription is missing auth key.",
        );
      }

      const client = createClient();

      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();

      if (userError) {
        throw new Error(
          `Auth error: ${userError.message}`,
        );
      }

      if (!user) {
        throw new Error(
          "No authenticated user was found.",
        );
      }

      const { data, error } = await client.rpc(
        "claim_study_push_subscription",
        {
          p_endpoint: subscription.endpoint,
          p_p256dh: p256dh,
          p_auth: auth,
          p_user_agent: navigator.userAgent,
        },
      );

      if (error) {
        throw new Error(
          `Supabase: ${error.message}`,
        );
      }

      if (!data) {
        throw new Error(
          "Supabase did not return a subscription ID.",
        );
      }

      setConnected(true);

      setMessage(
        isArabic
          ? "تم ربط هذا الجهاز بإشعارات Focusly ✅"
          : "This device is connected to Focusly notifications ✅",
      );
    } catch (error) {
      console.error(
        "Focusly push notification error:",
        error,
      );

      setConnected(false);

      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      setMessage(
        isArabic
          ? `تعذر تفعيل الإشعارات: ${errorMessage}`
          : `Could not enable notifications: ${errorMessage}`,
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendTestNotification() {
    setTesting(true);
    setMessage("");

    try {
      const client = createClient();

      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();

      if (userError || !user) {
        throw new Error(
          isArabic
            ? "لازم تكون مسجل دخول."
            : "You must be signed in.",
        );
      }

      const { data, error } =
        await client.functions.invoke(
          "send-test-push",
          {
            body: {},
          },
        );

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.sent < 1) {
        throw new Error(
          isArabic
            ? "لم يتم إرسال الإشعار لأي جهاز."
            : "No notification was sent.",
        );
      }

      setMessage(
        isArabic
          ? "تم إرسال الإشعار التجريبي 🔔"
          : "Test notification sent 🔔",
      );
    } catch (error) {
      console.error(
        "Focusly test push error:",
        error,
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      setMessage(
        isArabic
          ? `تعذر إرسال الإشعار: ${errorMessage}`
          : `Could not send notification: ${errorMessage}`,
      );
    } finally {
      setTesting(false);
    }
  }

  if (permission === "unsupported") {
    return (
      <div className="grid gap-2">
        <h2 className="text-lg font-semibold">
          {isArabic
            ? "إشعارات المواعيد"
            : "Schedule notifications"}
        </h2>

        <p className="muted text-sm">
          {isArabic
            ? "المتصفح ده لا يدعم إشعارات الويب."
            : "This browser does not support web notifications."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold">
          {isArabic
            ? "إشعارات المواعيد"
            : "Schedule notifications"}
        </h2>

        <p className="muted mt-1 text-sm">
          {isArabic
            ? "فعّل الإشعارات علشان Focusly يقدر يفكرك بالدروس والمحاضرات."
            : "Enable notifications so Focusly can remind you about lessons and lectures."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={enableNotifications}
          disabled={loading}
        >
          {loading
            ? isArabic
              ? "جاري التفعيل..."
              : "Enabling..."
            : connected
              ? isArabic
                ? "الإشعارات متصلة ✓"
                : "Notifications connected ✓"
              : permission === "granted"
                ? isArabic
                  ? "إكمال تفعيل الإشعارات"
                  : "Finish enabling notifications"
                : isArabic
                  ? "تفعيل الإشعارات"
                  : "Enable notifications"}
        </Button>

        {permission === "granted" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={sendTestNotification}
            disabled={testing}
          >
            {testing
              ? isArabic
                ? "جاري الإرسال..."
                : "Sending..."
              : isArabic
                ? "إرسال إشعار تجريبي 🔔"
                : "Send test notification 🔔"}
          </Button>
        ) : null}
      </div>

      {message ? (
        <p className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}