import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AlertCircle, ArrowLeftRight, CheckCircle2, CircleDollarSign, Clock, HelpCircle, Scissors, Trash2, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type FilterType = "all" | "customer" | "owner" | "admin" | "refunded" | "pending_refund" | "rescheduled";

const CancellationsPage = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchCancellations = async () => {
    setLoading(true);
    try {
      // Use admin-api (service role key) to bypass RLS — same pattern as BookingsPage
      // admin-api does not support OR filters, so we fetch all bookings and filter client-side
      const { data: res, error } = await supabase.functions.invoke("admin-api", {
        body: {
          action: "SELECT",
          table: "bookings",
          query: "*, salons(name), customers(full_name)",
        },
      });

      if (error) throw error;
      // admin-api returns { data: [...] }
      const allRows: any[] = res?.data || [];
      // Filter to only cancelled + rescheduled
      const rows = allRows.filter(
        (b: any) => b.status === "cancelled" || b.status === "rescheduled"
      );
      // Sort by updated_at descending (most recent first)
      rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setBookings(rows);
    } catch (error: any) {
      console.error("Error fetching cancellations:", error);
      toast.error("Failed to load cancelled bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCancellations();
  }, []);

  const handleManualRefund = async (bookingId: string) => {
    const confirmRefund = window.confirm("Are you sure you want to manually process/retry the refund for this booking?");
    if (!confirmRefund) return;

    setProcessingId(bookingId);
    try {
      const { data: res, error } = await supabase.functions.invoke("cancel-booking", {
        body: {
          booking_id: bookingId,
          action: "admin_manual_refund"
        }
      });

      if (error || !res?.success) {
        throw new Error(res?.error || error?.message || "Refund failed");
      }

      toast.success(`Refund processed! Amount: ₹${res.refund_amount}. Status: ${res.refund_status}`);
      fetchCancellations();
    } catch (err: any) {
      console.error("Manual refund error:", err);
      toast.error("Failed to process refund: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h >= 12 ? "PM" : "AM";
    
    const formattedDate = new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return `${formattedDate} · ${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const formatCancelTime = (isoStr: string) => {
    if (!isoStr) return "N/A";
    return new Date(isoStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Filter bookings
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      (b.booking_ref && b.booking_ref.toLowerCase().includes(search.toLowerCase())) ||
      (b.customers?.full_name && b.customers.full_name.toLowerCase().includes(search.toLowerCase())) ||
      (b.salons?.name && b.salons.name.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (filter === "all") return true;
    if (filter === "customer") return b.cancelled_by === "customer" || (!b.cancelled_by);
    // Owner filter: catch owner, emergency, salon, or any other non-customer/non-admin initiated cancellation
    if (filter === "owner") return (
      b.cancelled_by === "owner" ||
      b.cancelled_by === "emergency" ||
      b.cancelled_by === "salon" ||
      (b.cancelled_by && b.cancelled_by !== "customer" && b.cancelled_by !== "admin")
    );
    if (filter === "admin") return b.cancelled_by === "admin";
    if (filter === "refunded") return b.refund_status === "refunded" || b.payment_status === "refunded";
    // Pending Refund: has a real payment, refund not yet completed or failed — exclude already refunded/rescheduled
    if (filter === "pending_refund") {
      const alreadyDone =
        b.refund_status === "refunded" ||
        b.refund_status === "rescheduled" ||
        b.payment_status === "refunded";
      if (alreadyDone) return false;
      return (
        b.refund_status === "processing" ||
        b.refund_status === "pending_choice" ||
        b.refund_status === "failed" ||
        // null refund_status but has a paid payment = needs action
        (!b.refund_status && (b.phonepe_transaction_id || b.phonepe_merchant_transaction_id || b.razorpay_payment_id || b.payment_status === 'paid') && (b.total_amount ?? 0) > 0)
      );
    }
    // Rescheduled: either the refund_status is rescheduled, or the booking status itself is rescheduled
    if (filter === "rescheduled") return b.refund_status === "rescheduled" || b.status === "rescheduled";

    return true;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Booking Cancellations</h1>
            <p className="text-muted-foreground mt-1">Audit cancellation logs, refund statuses, and platform fees</p>
          </div>
          <Button onClick={fetchCancellations} size="sm" variant="outline" className="gap-1.5 self-start">
            <Clock className="h-4 w-4" /> Refresh Data
          </Button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {([
              { key: "all", label: "All" },
              { key: "customer", label: "Customer" },
              { key: "owner", label: "Owner" },
              { key: "admin", label: "Admin" },
              { key: "refunded", label: "Refunded" },
              { key: "pending_refund", label: "Pending Refund" },
              { key: "rescheduled", label: "Rescheduled" },
            ] as { key: FilterType; label: string }[]).map(({ key, label }) => (
              <Button
                key={key}
                variant={filter === key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="w-full md:w-80">
            <Input
              type="text"
              placeholder="Search by ID, Salon, Customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background"
            />
          </div>
        </div>

        {/* Cards Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-red-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Total Cancelled</p>
              <h3 className="text-2xl font-bold mt-1">{bookings.length}</h3>
            </div>
            <XCircle className="h-8 w-8 text-red-500/20" />
          </Card>
          <Card className="p-4 border-l-4 border-l-orange-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Owner Cancelled</p>
              <h3 className="text-2xl font-bold mt-1">
                {bookings.filter((b) =>
                  b.cancelled_by === "owner" ||
                  b.cancelled_by === "emergency" ||
                  b.cancelled_by === "salon" ||
                  (b.cancelled_by && b.cancelled_by !== "customer" && b.cancelled_by !== "admin")
                ).length}
              </h3>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-500/20" />
          </Card>
          <Card className="p-4 border-l-4 border-l-green-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Total Refunded</p>
              <h3 className="text-2xl font-bold mt-1">
                ₹{bookings.filter((b) => b.refund_status === "refunded").reduce((sum, b) => sum + (b.refund_amount || 0), 0)}
              </h3>
            </div>
            <CircleDollarSign className="h-8 w-8 text-green-500/20" />
          </Card>
          <Card className="p-4 border-l-4 border-l-blue-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Rescheduled Slots</p>
              <h3 className="text-2xl font-bold mt-1">
                {bookings.filter((b) => b.refund_status === "rescheduled").length}
              </h3>
            </div>
            <ArrowLeftRight className="h-8 w-8 text-blue-500/20" />
          </Card>
        </div>

        {/* Cancellation List Table */}
        <Card className="overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs font-bold text-muted-foreground uppercase">
                  <th className="p-4">Booking Details</th>
                  <th className="p-4">Customer & Salon</th>
                  <th className="p-4">Cancellation Type</th>
                  <th className="p-4">Refund Info</th>
                  <th className="p-4">Fee Retained</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Loading cancellation records...
                    </td>
                  </tr>
                ) : filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No cancellations match this filter or search query.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => {
                    const isOwnerCancelled = b.cancelled_by === "owner" || b.cancelled_by === "emergency";
                    const isAdminCancelled = b.cancelled_by === "admin";
                    // Platform fee: waived for owner/admin cancel, retained for customer cancel
                    const platformFeeRetained = (isOwnerCancelled || isAdminCancelled) ? 0 : (b.platform_fee ?? 25);
                    const grandTotal = b.total_amount ?? 0;
                    // Expected refund amount shown in button tooltip
                    const expectedRefund = (isOwnerCancelled || isAdminCancelled)
                      ? grandTotal
                      : Math.max(0, grandTotal - (b.platform_fee ?? 25));
                    // Show refund button: has amount, not yet refunded/rescheduled, and not a zero-payment booking
                    const alreadySettled =
                      b.refund_status === "refunded" ||
                      b.refund_status === "rescheduled" ||
                      b.payment_status === "refunded";
                    const canRetryRefund =
                      !alreadySettled &&
                      grandTotal > 0 &&
                      expectedRefund > 0;
                    return (
                      <tr key={b.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4 space-y-1">
                          <p className="font-bold text-foreground">
                            {b.booking_ref || `RZ-${b.id.slice(0, 6).toUpperCase()}`}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                            Slot: {formatDateTime(b.booking_date, b.booking_time)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            ID: <span className="font-mono text-muted-foreground/70">{b.id}</span>
                          </p>
                        </td>
                        <td className="p-4 space-y-1">
                          <p className="font-semibold text-foreground">
                            {b.customers?.full_name || "Guest Customer"}
                          </p>
                          <p className="text-xs text-primary font-bold flex items-center gap-1">
                            <Scissors className="h-3 w-3" /> {b.salons?.name || "Salon Name"}
                          </p>
                        </td>
                        <td className="p-4 space-y-1">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              b.cancelled_by === "emergency"
                                ? "bg-red-700/15 text-red-400 border border-red-600/25"
                                : b.cancelled_by === "admin"
                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                : isOwnerCancelled
                                ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {b.cancelled_by === "emergency"
                              ? "🚨 Emergency Closure"
                              : b.cancelled_by === "admin"
                              ? "Admin Cancelled"
                              : isOwnerCancelled
                              ? "Salon Cancelled"
                              : "Customer Cancelled"}
                          </span>
                          <p className="text-xs text-muted-foreground font-medium mt-1">
                            Time: {formatCancelTime(b.cancelled_at || b.updated_at)}
                          </p>
                          {b.cancel_reason && (
                            <p className="text-[11px] text-muted-foreground italic truncate max-w-[200px]" title={b.cancel_reason}>
                              {b.cancel_reason}
                            </p>
                          )}

                        </td>
                        <td className="p-4 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            {b.refund_status === "refunded" || b.payment_status === "refunded" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-bold text-green-400 border border-green-500/20">
                                ✓ Refunded
                              </span>
                            ) : b.refund_status === "processing" || b.refund_status === "pending_choice" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/20">
                                <Clock className="h-3 w-3 animate-spin" /> Pending choice/process
                              </span>
                            ) : b.refund_status === "rescheduled" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-400 border border-blue-500/20">
                                🔄 Rescheduled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-bold text-red-400 border border-red-500/20">
                                ✗ No Refund / Failed
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-foreground">
                            Refund: ₹{b.refund_amount ?? 0} <span className="text-[10px] text-muted-foreground">(of ₹{grandTotal})</span>
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-foreground">
                            ₹{platformFeeRetained}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {(isOwnerCancelled || isAdminCancelled) ? "Waived / Full Refund" : "Retained Charge"}
                          </p>
                        </td>
                        <td className="p-4 space-y-1">
                          {canRetryRefund ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processingId === b.id}
                              onClick={() => handleManualRefund(b.id)}
                              className="text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 h-8"
                            >
                              {processingId === b.id
                                ? "Processing..."
                                : `Refund ₹${expectedRefund}`}
                            </Button>
                          ) : b.refund_status === "rescheduled" ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Rescheduled
                            </span>
                          ) : b.refund_status === "refunded" || b.payment_status === "refunded" ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Settled
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">— No payment</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default CancellationsPage;
