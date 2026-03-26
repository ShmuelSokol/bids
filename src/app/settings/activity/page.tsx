import { createServiceClient } from "@/lib/supabase-server";
import { ActivityFeed } from "./activity-feed";

async function getData() {
  const supabase = createServiceClient();

  // Recent activity (last 7 days, max 500)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: activity } = await supabase
    .from("user_activity")
    .select("*")
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(500);

  // Active users today
  const todayStart = new Date(new Date().toDateString()).toISOString();
  const { data: todayActivity } = await supabase
    .from("user_activity")
    .select("user_name, event_type, created_at")
    .gte("created_at", todayStart)
    .order("created_at", { ascending: false });

  const activeUsers = new Map<string, { actions: number; lastSeen: string; types: Set<string> }>();
  for (const a of todayActivity || []) {
    const name = a.user_name || "Anonymous";
    if (!activeUsers.has(name)) activeUsers.set(name, { actions: 0, lastSeen: a.created_at, types: new Set() });
    const u = activeUsers.get(name)!;
    u.actions++;
    u.types.add(a.event_type);
  }

  return {
    activity: activity || [],
    activeUsers: Array.from(activeUsers.entries()).map(([name, data]) => ({
      name,
      actions: data.actions,
      lastSeen: data.lastSeen,
      types: Array.from(data.types),
    })),
  };
}

export default async function ActivityPage() {
  const { activity, activeUsers } = await getData();

  return (
    <div className="p-4 md:p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">User Activity</h1>
        <p className="text-muted mt-1 text-sm">
          Track all user interactions across the system
        </p>
      </div>
      <ActivityFeed initialActivity={activity} activeUsers={activeUsers} />
    </div>
  );
}
