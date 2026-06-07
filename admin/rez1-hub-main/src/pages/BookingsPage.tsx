import AdminLayout from "@/components/AdminLayout";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Clock, CheckCircle2, XCircle, Settings2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { adminApi } from "@/utils/adminApi";

const bookingStatusMap: Record<string, "upcoming" | "approved" | "rejected"> = {
  upcoming: "upcoming",
  completed: "approved",
  cancelled: "rejected",
};

const WorkflowConfig = () => {
  const [config, setConfig] = useState({
    defaultBufferMinutes: 10,
    maxBookingWindowDays: 7,
    maxPersonsPerBooking: 10,
  });

  useEffect(() => {
    supabase.from("platform_config").select("value").eq("key", "global_config").single().then(({ data }) => {
      if (data?.value) {
        setConfig(prev => ({ ...prev, ...data.value }));
      }
    });
  }, []);

  const handleSave = async () => {
    // Need to merge with existing
    const { data } = await supabase.from("platform_config").select("value").eq("key", "global_config").single();
    const existing = data?.value || {};
    
    await supabase.from("platform_config").update({
      value: { ...existing, ...config }
    }).eq("key", "global_config");
    
    toast.success("Booking workflow config saved");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
        <Settings2 className="h-5 w-5" /> Booking Workflow Configuration
      </h2>
      <div className="grid grid-cols-3 gap-6">
        <div className="grid gap-2">
          <Label>Buffer Time (minutes)</Label>
          <Input type="number" value={config.defaultBufferMinutes} onChange={e => setConfig(c => ({ ...c, defaultBufferMinutes: Number(e.target.value) }))} />
          <p className="text-xs text-muted-foreground">Rest time between appointments</p>
        </div>
        <div className="grid gap-2">
          <Label>Booking Window (days)</Label>
          <Input type="number" value={config.maxBookingWindowDays} onChange={e => setConfig(c => ({ ...c, maxBookingWindowDays: Number(e.target.value) }))} />
          <p className="text-xs text-muted-foreground">How far in advance users can book</p>
        </div>
        <div className="grid gap-2">
          <Label>Max Persons per Booking</Label>
          <Input type="number" value={config.maxPersonsPerBooking} onChange={e => setConfig(c => ({ ...c, maxPersonsPerBooking: Number(e.target.value) }))} />
          <p className="text-xs text-muted-foreground">Maximum people in one booking</p>
        </div>
      </div>
      <Button onClick={handleSave} className="mt-2">Save Configuration</Button>
    </div>
  );
};

const BookingsPage = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [salonFilter, setSalonFilter] = useState("All Salons");
  const [salonsList, setSalonsList] = useState<string[]>(["All Salons"]);

  const fetchBookings = async () => {
    try {
      // Use admin-api (service role) to bypass RLS and fetch all bookings with joins
      const { data, error } = await supabase.functions.invoke('admin-api', {
        body: {
          action: 'SELECT',
          table: 'bookings',
          query: '*, salons(name), customers(full_name, phone)',
        }
      });
      const rows = data?.data || [];
      setBookings(rows);
      const uniqueSalons = Array.from(new Set(rows.map((b: any) => b.salons?.name).filter(Boolean))) as string[];
      setSalonsList(["All Salons", ...uniqueSalons]);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const filtered = bookings.filter(b => {
    const matchSearch = (b.customers?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
                        (b.services?.[0]?.name || "").toLowerCase().includes(search.toLowerCase());
    const matchSalon = salonFilter === "All Salons" || b.salons?.name === salonFilter;
    return matchSearch && matchSalon;
  });

  const handleCancel = async (id: string) => {
    const reason = window.prompt("Please provide a reason for cancellation:");
    if (!reason || reason.trim() === "") {
      toast.error("Cancellation reason is required");
      return;
    }
    const { error } = await supabase.functions.invoke('cancel-booking', { 
      body: { 
        booking_id: id, 
        cancel_reason: reason.trim(),
        cancelled_by: 'admin'
      } 
    });
    if (error) {
      toast.error("Failed to cancel booking");
      return;
    }
    toast.success("Booking cancelled by admin");
    fetchBookings();
  };

  const handleComplete = async (id: string) => {
    await supabase.functions.invoke('admin-api', { body: { action: 'UPDATE', table: 'bookings', id, data: { status: 'completed' } } });
    toast.success("Booking marked as completed");
    fetchBookings();
  };

  const statsBookings = salonFilter === "All Salons" ? bookings : bookings.filter(b => b.salons?.name === salonFilter);
  const stats = {
    upcoming: statsBookings.filter(b => b.status === "upcoming").length,
    completed: statsBookings.filter(b => b.status === "completed").length,
    cancelled: statsBookings.filter(b => b.status === "cancelled").length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Booking Oversight</h1>
          <p className="text-muted-foreground mt-1">Live booking feed & configuration</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold text-card-foreground">{stats.upcoming}</p>
              <p className="text-xs text-muted-foreground">Upcoming / Active</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="text-2xl font-bold text-card-foreground">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-card-foreground">{stats.cancelled}</p>
              <p className="text-xs text-muted-foreground">Cancelled</p>
            </div>
          </div>
        </div>

        <WorkflowConfig />

        <div className="flex items-center gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search user or service..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={salonFilter} onValueChange={setSalonFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filter by Salon" /></SelectTrigger>
            <SelectContent>
              {salonsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          {["all", "upcoming", "completed", "cancelled"].map(tab => (
            <TabsContent key={tab} value={tab}>
              <div className="rounded-xl border border-border bg-card overflow-hidden mt-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Booking ID</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">User</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Salon</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Service</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Date/Time</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Duration</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Amount</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Status</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered
                      .filter(b => tab === "all" || b.status === tab)
                      .map(booking => {
                        const totalDuration = booking.services?.reduce((acc: number, cur: any) => acc + (cur.duration || 30), 0) || 30;
                        return (
                        <tr key={booking.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-card-foreground">#{booking.id.split('-')[0].toUpperCase()}</td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-card-foreground">{booking.customers?.full_name || "Guest Customer"}</p>
                            <p className="text-xs text-muted-foreground">{booking.customers?.phone || "No phone"}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{booking.salons?.name}</td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {booking.services && booking.services.length > 0
                              ? booking.services.map((s: any) => s.name).join(", ")
                              : "Service"}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{booking.booking_date} · {booking.booking_time}</td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{totalDuration}m</td>
                          <td className="px-6 py-4 text-sm font-medium text-card-foreground">₹{booking.total_amount ?? booking.total_price ?? "—"}</td>
                          <td className="px-6 py-4"><StatusBadge status={bookingStatusMap[booking.status] as any} /></td>
                          <td className="px-6 py-4 text-right">
                            {booking.status === "upcoming" && (
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => handleComplete(booking.id)}>Complete</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleCancel(booking.id)}>Cancel</Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )})}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">No bookings found.</td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default BookingsPage;
