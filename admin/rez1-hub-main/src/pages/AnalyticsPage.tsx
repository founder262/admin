import AdminLayout from "@/components/AdminLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useState, useEffect } from "react";
import { adminApi } from "@/utils/adminApi";

const COLORS = {
  active: "hsl(142, 71%, 45%)",
  inactive: "hsl(220, 9%, 46%)",
  pending: "hsl(38, 92%, 50%)"
};

const AnalyticsPage = () => {
  const [bookingData, setBookingData] = useState<any[]>([]);
  const [salonStatusData, setSalonStatusData] = useState<any[]>([]);
  const [topSalons, setTopSalons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setError(null);
        // Use service-role edge function — bypasses RLS on bookings/salons
        const raw = await adminApi.analytics();

        // 1. Weekly Bookings chart data (last 7 days)
        const bookings: any[] = raw.weeklyBookings || [];
        const days: { dateStr: string; label: string }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          days.push({
            dateStr: d.toISOString().split("T")[0],
            label: d.toLocaleDateString("en-US", { weekday: "short" }),
          });
        }
        const chartData = days.map(({ dateStr, label }) => ({
          name: label,
          bookings: bookings.filter((b) => b.booking_date === dateStr).length,
        }));
        setBookingData(chartData);

        // 2. Salon Status pie
        const salons: any[] = raw.salons || [];
        const pendingCount = (raw.pendingRequests || []).length;
        let active = 0, inactive = 0;
        salons.forEach((s) => {
          if (s.is_suspended) inactive++;
          else active++;
        });
        setSalonStatusData([
          { name: "Active", value: active, color: COLORS.active },
          { name: "Inactive", value: inactive, color: COLORS.inactive },
          { name: "Pending", value: pendingCount, color: COLORS.pending },
        ]);

        // 3. Top Salons by completed bookings
        const completed: any[] = raw.completedBookings || [];
        const salonStats: Record<string, { bookings: number; revenue: number }> = {};
        completed.forEach((b: any) => {
          const sName = b.salons?.name;
          if (sName) {
            if (!salonStats[sName]) salonStats[sName] = { bookings: 0, revenue: 0 };
            salonStats[sName].bookings++;
            salonStats[sName].revenue += Number(b.total_price || 0);
          }
        });
        const top = Object.entries(salonStats)
          .map(([name, stat]) => ({
            name,
            bookings: stat.bookings,
            revenue: `₹${stat.revenue.toLocaleString("en-IN")}`,
            revenueNum: stat.revenue,
          }))
          .sort((a, b) => b.revenueNum - a.revenueNum)
          .slice(0, 5);
        setTopSalons(top);
      } catch (err: any) {
        console.error("Analytics fetch error:", err);
        setError(err?.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Platform performance overview</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">Loading Analytics...</div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-destructive">{error}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Weekly Bookings Bar Chart */}
              <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 animate-fade-in">
                <h2 className="text-lg font-semibold text-card-foreground mb-4">Weekly Bookings</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={bookingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--card-foreground))",
                      }}
                      formatter={(value: any) => [value, "Bookings"]}
                    />
                    <Bar dataKey="bookings" fill="hsl(142, 71%, 45%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Salon Status Pie */}
              <div className="rounded-xl border border-border bg-card p-6 animate-fade-in">
                <h2 className="text-lg font-semibold text-card-foreground mb-4">Salon Status</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={salonStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      paddingAngle={4}
                    >
                      {salonStatusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--card-foreground))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                  {salonStatusData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      {entry.name} ({entry.value})
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Salons Table */}
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-card-foreground mb-4">Top Performing Salons (Completed Bookings)</h2>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">#</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Salon</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Bookings</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topSalons.map((salon, i) => (
                    <tr key={salon.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-card-foreground">{salon.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{salon.bookings}</td>
                      <td className="px-4 py-3 text-sm font-medium text-success">{salon.revenue}</td>
                    </tr>
                  ))}
                  {topSalons.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">
                        No completed bookings yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AnalyticsPage;
