import AdminLayout from "@/components/AdminLayout";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { Users, Store, Inbox, CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { adminApi } from "@/utils/adminApi";

const Dashboard = () => {
  const [stats, setStats] = useState({ totalUsers: 0, totalSalons: 0, pendingRequests: 0, todayBookings: 0 });
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];

    const loadData = async () => {
      try {
        const [users, salons, requests, bookings] = await Promise.all([
          adminApi.fetch("customers"),
          adminApi.fetch("salons"),
          adminApi.fetch("salon_requests"),
          adminApi.fetch("bookings", "*", undefined) // Get all bookings for filtering locally if needed, or update proxy to handle queries
        ]);

        const todayBookings = (bookings || []).filter(
          (b: any) => b.booking_date === today && b.status !== "cancelled" && b.status !== "rescheduled"
        );

        setStats({
          totalUsers: (users || []).length,
          totalSalons: (salons || []).length,
          pendingRequests: (requests || []).filter((r: any) => r.status === "pending").length,
          todayBookings: todayBookings.length,
        });

        // Recent requests (already ordered by created_at in proxy)
        setRecentRequests((requests || []).slice(0, 4));

        // Today's bookings
        setRecentBookings(todayBookings.slice(0, 4));
      } catch (error) {
        console.error("Dashboard error:", error);
      }
    };

    loadData();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, Admin</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total Users"
            value={stats.totalUsers.toString()}
            icon={<Users className="h-6 w-6" />}
            trend=""
            trendUp
          />
          <StatCard
            title="Total Salons"
            value={stats.totalSalons.toString()}
            icon={<Store className="h-6 w-6" />}
            trend=""
            trendUp
          />
          <StatCard
            title="Pending Requests"
            value={stats.pendingRequests.toString()}
            icon={<Inbox className="h-6 w-6" />}
            trend=""
            trendUp
          />
          <StatCard
            title="Today's Bookings"
            value={stats.todayBookings.toString()}
            icon={<CalendarDays className="h-6 w-6" />}
            trend=""
            trendUp
          />
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Requests */}
          <div className="rounded-xl border border-border bg-card p-6 animate-fade-in">
            <h2 className="text-lg font-semibold text-card-foreground mb-4">Recent Requests</h2>
            <div className="space-y-3">
              {recentRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{req.owner_name}</p>
                    <p className="text-xs text-muted-foreground">{req.salon_name}</p>
                  </div>
                  <StatusBadge status={req.status as any} />
                </div>
              ))}
              {recentRequests.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent requests.</p>
              )}
            </div>
          </div>

          {/* Today's Bookings */}
          <div className="rounded-xl border border-border bg-card p-6 animate-fade-in">
            <h2 className="text-lg font-semibold text-card-foreground mb-4">Today's Bookings</h2>
            <div className="space-y-3">
              {recentBookings.map((booking) => {
                const serviceName = booking.services?.[0]?.name || "Service";
                return (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{booking.customers?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.salons?.name} · {serviceName}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{booking.booking_time}</span>
                  </div>
                );
              })}
              {recentBookings.length === 0 && (
                <p className="text-sm text-muted-foreground">No bookings today.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
