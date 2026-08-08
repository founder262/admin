import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  AlertCircle, ArrowLeftRight, CheckCircle2, CircleDollarSign,
  Clock, HelpCircle, Scissors, Trash2, XCircle, Eye, X,
  User, Phone, Mail, CreditCard, Hash, CalendarDays, Receipt,
  Banknote, RefreshCw, Info, Building2, AlertTriangle
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type FilterType = "all" | "customer" | "owner" | "admin" | "refunded" | "pending_refund" | "rescheduled";

/* ─── Transaction Detail Modal ─────────────────────────────────────────── */
const TransactionModal = ({ booking, onClose }: { booking: any; onClose: () => void }) => {
  if (!booking) return null;

  const isOwnerCancelled = booking.cancelled_by === "owner" || booking.cancelled_by === "emergency";
  const isAdminCancelled = booking.cancelled_by === "admin";
  const platformFeeRetained = (isOwnerCancelled || isAdminCancelled) ? 0 : (booking.platform_fee ?? 25);
  const grandTotal = booking.total_amount ?? 0;
  const expectedRefund = (isOwnerCancelled || isAdminCancelled)
    ? grandTotal
    : Math.max(0, grandTotal - (booking.platform_fee ?? 25));

  const cancelledByLabel =
    booking.cancelled_by === "emergency" ? "🚨 Emergency Closure" :
    booking.cancelled_by === "admin" ? "Admin Cancelled" :
    isOwnerCancelled ? "Salon / Owner Cancelled" : "Customer Cancelled";

  const refundStatusColor =
    booking.refund_status === "refunded" || booking.payment_status === "refunded"
      ? "text-green-400 bg-green-500/10 border-green-500/20"
      : booking.refund_status === "processing"
      ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
      : booking.refund_status === "pending_choice"
      ? "text-primary bg-primary/10 border-primary/20"
      : booking.refund_status === "rescheduled"
      ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
      : booking.refund_status === "failed"
      ? "text-red-400 bg-red-500/10 border-red-500/20"
      : booking.refund_status === "refund_requested"
      ? "text-purple-400 bg-purple-500/10 border-purple-500/20 animate-pulse"
      : "text-muted-foreground bg-muted/30 border-border";

  const refundStatusLabel =
    booking.refund_status === "refunded" || booking.payment_status === "refunded"
      ? "✓ Refunded — Money Released by Gateway"
      : booking.refund_status === "processing"
      ? "⏳ Refund Initiated — Awaiting Gateway Confirmation"
      : booking.refund_status === "pending_choice"
      ? "⌛ Awaiting Customer Choice (Refund or Reschedule)"
      : booking.refund_status === "rescheduled"
      ? "🔄 Rescheduled"
      : booking.refund_status === "failed"
      ? "text-red-400 bg-red-500/10 border-red-500/20"
      : booking.refund_status === "refund_requested"
      ? "🚨 Customer Escalated — Unreceived Refund Request"
      : "— No Refund Applicable";

  const formatFull = (isoStr: string) => {
    if (!isoStr) return "N/A";
    return new Date(isoStr).toLocaleString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  };

  const Row = ({ icon: Icon, label, value, mono = false, highlight = false }: any) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-medium mt-0.5 break-all ${mono ? "font-mono text-xs" : ""} ${highlight ? "text-primary font-bold" : "text-foreground"}`}>
          {value || "N/A"}
        </p>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border shadow-2xl"
        style={{ background: "hsl(var(--card))" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border"
          style={{ background: "hsl(var(--card))" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Transaction Details</h2>
              <p className="text-xs text-muted-foreground font-mono">
                {booking.booking_ref || `RZ-${booking.id?.slice(0, 6).toUpperCase()}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Status Banner */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold ${refundStatusColor}`}>
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>Refund Status: {refundStatusLabel}</span>
            <span className="ml-auto text-xs font-normal opacity-70">
              Cancelled by: {cancelledByLabel}
            </span>
          </div>

          {/* Customer Info */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Customer Information
            </h3>
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-1 divide-y divide-border/40">
              <Row icon={User} label="Full Name" value={booking.customers?.full_name || "Guest Customer"} />
              <Row icon={Phone} label="Phone" value={booking.customers?.phone || booking.customers?.mobile} />
              <Row icon={Mail} label="Email" value={booking.customers?.email} />
              <Row icon={Hash} label="Customer ID" value={booking.customer_id} mono />
            </div>
          </section>

          {/* Booking Details */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5" /> Booking Details
            </h3>
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-1 divide-y divide-border/40">
              <Row icon={Hash} label="Booking ID" value={booking.id} mono />
              <Row icon={Hash} label="Booking Ref" value={booking.booking_ref || `RZ-${booking.id?.slice(0, 6).toUpperCase()}`} />
              <Row icon={Building2} label="Salon" value={booking.salons?.name} />
              <Row icon={Hash} label="Salon ID" value={booking.salon_id} mono />
              <Row icon={CalendarDays} label="Booking Date" value={booking.booking_date} />
              <Row icon={Clock} label="Booking Time" value={booking.booking_time} />
              <Row icon={CalendarDays} label="Booked On" value={formatFull(booking.created_at)} />
              <Row icon={CalendarDays} label="Cancelled At" value={formatFull(booking.cancelled_at || booking.updated_at)} />
              {booking.cancel_reason && (
                <Row icon={Info} label="Cancel Reason" value={booking.cancel_reason} />
              )}
            </div>
          </section>

          {/* Payment & Transaction */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5" /> Payment & Transaction
            </h3>
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-1 divide-y divide-border/40">
              <Row icon={Banknote} label="Total Amount Paid" value={`₹${grandTotal}`} highlight />
              <Row icon={Banknote} label="Refund Amount" value={`₹${booking.refund_amount ?? 0} (of ₹${grandTotal})`} />
              <Row icon={Banknote} label="Platform Fee Retained" value={`₹${platformFeeRetained}`} />
              <Row icon={CreditCard} label="Payment Method" value={(booking.payment_method || "PhonePe").toUpperCase()} />
              <Row icon={CreditCard} label="Payment Status" value={(booking.payment_status || "—").toUpperCase()} />
              <Row icon={Hash} label="PhonePe Transaction ID" value={booking.phonepe_transaction_id} mono />
              <Row icon={Hash} label="Merchant Transaction ID" value={booking.phonepe_merchant_transaction_id} mono />
              {booking.razorpay_payment_id && (
                <Row icon={Hash} label="Razorpay Payment ID" value={booking.razorpay_payment_id} mono />
              )}
              {booking.razorpay_order_id && (
                <Row icon={Hash} label="Razorpay Order ID" value={booking.razorpay_order_id} mono />
              )}
            </div>
          </section>

          {/* Amount Breakdown */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <Receipt className="h-3.5 w-3.5" /> Amount Breakdown
            </h3>
            <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border/40">
              {[
                { label: "Service Amount", value: booking.service_amount ?? (grandTotal - (booking.platform_fee ?? 25) - (booking.gst_amount ?? 0)) },
                { label: "Platform Fee", value: booking.platform_fee ?? 25 },
                { label: "GST", value: booking.gst_amount ?? 0 },
                { label: "Total", value: grandTotal, bold: true },
              ].map(({ label, value, bold }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className={`text-sm ${bold ? "font-bold text-foreground" : "text-muted-foreground"}`}>{label}</span>
                  <span className={`text-sm ${bold ? "font-bold text-primary" : "font-medium text-foreground"}`}>₹{value ?? 0}</span>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-border px-6 py-4 flex justify-end gap-2"
          style={{ background: "hsl(var(--card))" }}>
          <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Page ─────────────────────────────────────────────────────────── */
const CancellationsPage = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  const fetchCancellations = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("admin-api", {
        body: {
          action: "SELECT",
          table: "bookings",
          query: "*, salons(name), customers(full_name, phone, email)",
        },
      });

      if (error) throw error;
      const allRows: any[] = res?.data || [];
      const rows = allRows.filter(
        (b: any) => b.status === "cancelled" || b.status === "rescheduled"
      );
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

      if (res.refund_status === 'processing') {
        toast.success(`Refund of ₹${res.refund_amount} initiated with PhonePe/Razorpay. Status will update to ‘Refunded’ once the gateway confirms the money has been released (usually within 1–90 minutes).`, { duration: 8000 });
      } else if (res.refund_status === 'failed') {
        toast.error(`Refund initiation failed. No valid payment transaction found or the gateway rejected the request.`);
      } else {
        toast.success(`Refund processed. Status: ${res.refund_status}`);
      }
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
      day: "numeric", month: "short", year: "numeric",
    });
    return `${formattedDate} · ${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const formatCancelTime = (isoStr: string) => {
    if (!isoStr) return "N/A";
    return new Date(isoStr).toLocaleString("en-IN", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  };

  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      (b.booking_ref && b.booking_ref.toLowerCase().includes(search.toLowerCase())) ||
      (b.customers?.full_name && b.customers.full_name.toLowerCase().includes(search.toLowerCase())) ||
      (b.salons?.name && b.salons.name.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (filter === "all") return true;
    if (filter === "customer") return b.cancelled_by === "customer" || (!b.cancelled_by);
    if (filter === "owner") return (
      b.cancelled_by === "owner" ||
      b.cancelled_by === "emergency" ||
      b.cancelled_by === "salon" ||
      (b.cancelled_by && b.cancelled_by !== "customer" && b.cancelled_by !== "admin")
    );
    if (filter === "admin") return b.cancelled_by === "admin";
    if (filter === "refunded") return b.refund_status === "refunded" || b.payment_status === "refunded";
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
        (!b.refund_status && (b.phonepe_transaction_id || b.phonepe_merchant_transaction_id || b.razorpay_payment_id || b.payment_status === 'paid') && (b.total_amount ?? 0) > 0)
      );
    }
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
                    const platformFeeRetained = (isOwnerCancelled || isAdminCancelled) ? 0 : (b.platform_fee ?? 25);
                    const grandTotal = b.total_amount ?? 0;
                    const expectedRefund = (isOwnerCancelled || isAdminCancelled)
                      ? grandTotal
                      : Math.max(0, grandTotal - (b.platform_fee ?? 25));
                    const alreadySettled =
                      b.refund_status === "refunded" ||
                      b.refund_status === "rescheduled" ||
                      b.refund_status === "processing" || // refund already in flight — do not retry
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
                            ) : b.refund_status === "processing" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/20">
                                <Clock className="h-3 w-3 animate-spin" /> Refund Initiated
                              </span>
                            ) : b.refund_status === "pending_choice" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/20">
                                <Clock className="h-3 w-3" /> Awaiting Customer
                              </span>
                            ) : b.refund_status === "rescheduled" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-400 border border-blue-500/20">
                                🔄 Rescheduled
                              </span>
                            ) : b.refund_status === "failed" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-bold text-red-400 border border-red-500/20">
                                ✗ Refund Failed
                              </span>
                            ) : b.refund_status === "refund_requested" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-bold text-purple-400 border border-purple-500/30 animate-pulse">
                                <AlertTriangle className="h-3 w-3 text-purple-400" /> Customer Requested
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2.5 py-0.5 text-xs font-bold text-muted-foreground border border-border">
                                — No Payment
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
                        <td className="p-4 space-y-2">
                          {/* View Details Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedBooking(b)}
                            className="text-xs font-bold h-8 gap-1.5 border-muted-foreground/20 hover:bg-muted/30 w-full"
                          >
                            <Eye className="h-3.5 w-3.5" /> View Details
                          </Button>

                          {canRetryRefund ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processingId === b.id}
                              onClick={() => handleManualRefund(b.id)}
                              className={`text-xs font-bold h-8 w-full ${
                                b.refund_status === "refund_requested"
                                  ? "bg-purple-600 hover:bg-purple-500 text-white border-none shadow-lg shadow-purple-500/25"
                                  : b.refund_status === "failed"
                                  ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                                  : "border-primary/30 text-primary hover:bg-primary/10"
                              }`}
                            >
                              {processingId === b.id
                                ? "Initiating..."
                                : b.refund_status === "refund_requested"
                                ? `⚡ Process Request ₹${expectedRefund}`
                                : b.refund_status === "failed"
                                ? `Retry Refund ₹${expectedRefund}`
                                : `Refund ₹${expectedRefund}`}
                            </Button>
                          ) : b.refund_status === "processing" ? (
                            <span className="text-xs text-amber-400 flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 animate-spin" /> Refund sent to gateway
                            </span>
                          ) : b.refund_status === "rescheduled" ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Rescheduled
                            </span>
                          ) : b.refund_status === "refunded" || b.payment_status === "refunded" ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Settled
                            </span>
                          ) : b.refund_status === "failed" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processingId === b.id}
                              onClick={() => handleManualRefund(b.id)}
                              className="text-xs font-bold border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 w-full"
                            >
                              Retry Refund ₹{expectedRefund}
                            </Button>
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

      {/* Transaction Detail Modal */}
      {selectedBooking && (
        <TransactionModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </AdminLayout>
  );
};

export default CancellationsPage;
