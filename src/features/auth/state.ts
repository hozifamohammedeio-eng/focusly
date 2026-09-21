export type ErrorCode =
  | "invalid"
  | "credentials"
  | "exists"
  | "expired"
  | "unavailable"
  | "rateLimit"
  | "password"
  | "unconfirmed";
export type FormState = {
  error?: ErrorCode;
  success?: "confirmation" | "recovery";
  fields?: Record<string, string>;
};

export function authError(code?: string): ErrorCode {
  if (code === "email_not_confirmed") return "unconfirmed";
  if (code === "invalid_credentials") return "credentials";
  if (["user_already_exists", "email_exists"].includes(code ?? ""))
    return "exists";
  if (
    ["over_request_rate_limit", "over_email_send_rate_limit"].includes(
      code ?? "",
    )
  )
    return "rateLimit";
  if (["weak_password", "same_password"].includes(code ?? ""))
    return "password";
  return "unavailable";
}
