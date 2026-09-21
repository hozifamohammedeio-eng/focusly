import { planningData } from "@/features/planning/data";
import { SettingsPanel } from "@/features/profile/profile-ui";
export default async function Page() {
  const data = await planningData();
  return (
    <main id="main" className="study-main">
      <SettingsPanel profile={data.profile} settings={data.settings} email={data.email} />
    </main>
  );
}
