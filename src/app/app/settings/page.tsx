import { focusStudent } from "@/features/focus/data";
import { SettingsPanel } from "@/features/profile/profile-ui";
export default async function Page() {
  const data = await focusStudent();
  return (
    <main id="main" className="study-main">
      <SettingsPanel profile={data.profile} settings={data.settings} email={data.user.email ?? ""} />
    </main>
  );
}
