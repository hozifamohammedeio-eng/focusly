import { profileData } from "@/features/focus/data";
import { ProfileView } from "@/features/profile/profile-ui";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await profileData();
  return (
    <ProfileView
      profile={data.profile}
      email={data.email}
      subjectsCount={data.subjects.filter((subject) => !subject.archived_at).length}
      progress={data.progress}
    />
  );
}
