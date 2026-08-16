import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  CreditCard, IndianRupee, RefreshCw, CheckCircle2, XCircle, 
  RotateCcw, ArrowUpRight, Search, FileText, Lock, Zap, ShieldCheck
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { adminApi } from "@/utils/adminApi";

import { supabase } from "@/lib/supabase";

const PaymentsPage = () => {
  const [razorpayConfig, setRazorpayConfig] = useState({
    enabled: true,
    keyId: "",
    keySecret: "",
    webhookSecret: "",
  });

  const [config, setConfig] = useState({
    bookingFee: 25,
    processingDuration: 2,
    gstPercent: 18,
    refundWindowHours: 24,
  });

  const [configId, setConfigId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const fetchPaymentData = async () => {
    try {
      const data = await adminApi.fetch("platform_config", "*");
      if (data && data.length > 0) {
        const row = data[0];
        setConfigId(row.id);

        setRazorpayConfig({
          enabled: true,
          keyId: row.razorpay_key_id ?? "",
          keySecret: row.razorpay_key_secret ?? "",
          webhookSecret: row.razorpay_webhook_secret ?? "",
        });

        setConfig({
          bookingFee: row.booking_fee ?? 25,
          processingDuration: row.default_buffer_minutes ?? 10,
          gstPercent: row.gst_percent ?? 18,
          refundWindowHours: row.refund_window_hours ?? 24,
        });
      }

      setLoadingBookings(true);
      const bookingsData = await adminApi.fetch("bookings", "*, salons(name), customers(full_name, phone)");
      if (bookingsData) {
        setBookings(bookingsData);
      }
    } catch (error) {
      console.error("Config & Payment fetch error:", error);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchPaymentData();
  }, []);

  const handleSaveRazorpay = async () => {
    try {
      const payload = {
        razorpay_key_id: razorpayConfig.keyId,
        razorpay_key_secret: razorpayConfig.keySecret,
        razorpay_webhook_secret: razorpayConfig.webhookSecret,
      };

      if (configId) {
        await adminApi.update("platform_config", configId, payload);
      } else {
        await adminApi.insert("platform_config", payload);
      }
      toast.success("Razorpay Payment Gateway configuration saved successfully!");
    } catch (error: any) {
      toast.error("Failed to save Razorpay config: " + (error.message || "Unknown error"));
    }
  };

  const handleSavePricing = async () => {
    try {
      const payload = {
        booking_fee: config.bookingFee,
        gst_percent: config.gstPercent,
        refund_window_hours: config.refundWindowHours,
        default_buffer_minutes: config.processingDuration,
      };
      if (configId) {
        await adminApi.update("platform_config", configId, payload);
      } else {
        await adminApi.insert("platform_config", payload);
      }
      toast.success("Fee & Pricing configuration saved");
    } catch (error: any) {
      toast.error("Failed to save pricing config: " + (error.message || "Unknown error"));
    }
  };

  const handleTriggerRefund = async (bookingId: string) => {
    if (!window.confirm("Are you sure you want to trigger a manual refund for this booking?")) return;
    try {
      toast.loading("Processing refund...", { id: "refund-toast" });
      const { data: res, error: fnErr } = await supabase.functions.invoke("cancel-booking", {
        body: {
          booking_id: bookingId,
          action: "admin_manual_refund"
        }
      });
      if (fnErr || !res?.success) {
        throw new Error(res?.error || fnErr?.message || "Refund failed");
      }
      toast.success("Refund processed successfully!", { id: "refund-toast" });
      fetchPaymentData();
    } catch (err: any) {
      toast.error("Refund failed: " + (err.message || "Error processing refund"), { id: "refund-toast" });
    }
  };

  // Analytics Metrics
  const todayStr = new Date().toISOString().split("T")[0];
  const todayBookings = bookings.filter(b => b.created_at?.startsWith(todayStr) || b.booking_date === todayStr);
  const todayCollection = todayBookings
    .filter(b => b.payment_status === "paid")
    .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  
  const successfulPayments = bookings.filter(b => b.payment_status === "paid");
  const failedPayments = bookings.filter(b => b.payment_status === "failed" || b.status === "cancelled");
  const refundAmount = bookings
    .filter(b => b.refund_status === "refunded")
    .reduce((sum, b) => sum + (Number(b.refund_amount || b.total_amount) || 0), 0);
  const pendingSettlements = bookings
    .filter(b => b.payment_status === "paid" && b.status === "completed")
    .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

  const filteredBookings = bookings.filter(b => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      b.id?.toLowerCase().includes(term) ||
      b.razorpay_payment_id?.toLowerCase().includes(term) ||
      b.razorpay_order_id?.toLowerCase().includes(term) ||
      b.customers?.full_name?.toLowerCase().includes(term) ||
      b.salons?.name?.toLowerCase().includes(term)
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-8 pb-12">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Gateway & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Manage Razorpay credentials, inspect transaction logs, and process refunds.
          </p>
        </div>

        {/* Analytics Dashboard Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Today's Collection</p>
            <p className="text-xl font-bold text-foreground">₹{todayCollection}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Today's Transactions</p>
            <p className="text-xl font-bold text-foreground">{todayBookings.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Successful Payments</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{successfulPayments.length}</p>
          </div>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-1">
            <p className="text-xs font-semibold text-destructive">Failed Payments</p>
            <p className="text-xl font-bold text-destructive">{failedPayments.length}</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Refund Amount</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">₹{refundAmount}</p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1">
            <p className="text-xs font-semibold text-primary">Pending Settlements</p>
            <p className="text-xl font-bold text-primary">₹{pendingSettlements}</p>
          </div>
        </div>

        {/* Razorpay Payment Gateway Configuration */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#2C73FF]" />
                Razorpay Payment Gateway
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your API Key ID, Key Secret and Webhook Secret for Razorpay live payment processing.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{razorpayConfig.enabled ? "Enabled" : "Disabled"}</span>
              <Switch checked={razorpayConfig.enabled} onCheckedChange={v => setRazorpayConfig(prev => ({ ...prev, enabled: v }))} />
            </div>
          </div>

          {/* Razorpay Welcome Offer Banner */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-blue-300">🎉 Razorpay Welcome Offer — Zero Transaction Fees!</p>
              <p className="text-blue-400/80 text-xs">New merchants activated on or after <strong>1 July 2026</strong> get <strong>₹5,00,000 free GMV</strong> (zero platform fees) for <strong>90 days</strong> from KYC activation. No code needed — credits are applied automatically.</p>
            </div>
          </div>

          {razorpayConfig.enabled && (
            <div className="pt-4 border-t border-border space-y-6 animate-fade-in">
              {/* API Credentials */}
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                  <ShieldCheck className="h-4 w-4 text-primary" /> API Credentials
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2 md:col-span-2">
                    <Label className="font-semibold">Key ID</Label>
                    <Input
                      value={razorpayConfig.keyId}
                      onChange={e => setRazorpayConfig(c => ({ ...c, keyId: e.target.value }))}
                      placeholder="rzp_live_xxxxxxxxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">Found in Razorpay Dashboard → Settings → API Keys</p>
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-semibold">Key Secret</Label>
                    <Input
                      type="password"
                      value={razorpayConfig.keySecret}
                      onChange={e => setRazorpayConfig(c => ({ ...c, keySecret: e.target.value }))}
                      placeholder="Enter Key Secret"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-semibold">Webhook Secret</Label>
                    <Input
                      type="password"
                      value={razorpayConfig.webhookSecret}
                      onChange={e => setRazorpayConfig(c => ({ ...c, webhookSecret: e.target.value }))}
                      placeholder="Enter Webhook Secret"
                    />
                  </div>
                </div>
              </div>

              {/* Webhook Info */}
              <div className="space-y-3 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" /> Webhook & Callback Setup
                </h3>
                <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">Webhook URL</strong> (register in Razorpay Dashboard → Settings → Webhooks):</p>
                  <code className="block bg-background border border-border rounded px-3 py-2 text-[11px] text-primary break-all">
                    {`https://[your-project-ref].supabase.co/functions/v1/razorpay-webhook`}
                  </code>
                  <p className="pt-1"><strong className="text-foreground">Events to enable:</strong> payment.captured · payment.failed · refund.processed · order.paid</p>
                  <p><strong className="text-foreground">Active redirect routes:</strong> /payment/success · /payment/failed · /payment/cancel</p>
                </div>
              </div>

              <Button onClick={handleSaveRazorpay} className="w-full md:w-auto">
                Save Razorpay Configuration
              </Button>
            </div>
          )}
        </div>

        {/* Payment Transactions Table */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Payment Transactions</h2>
              <p className="text-sm text-muted-foreground">Detailed logs of customer bookings, Razorpay order IDs & payment statuses.</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order ID, payment ID, or customer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">Booking ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Salon</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Gateway</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Refund Status</th>
                  <th className="px-4 py-3">Razorpay Order ID</th>
                  <th className="px-4 py-3">Razorpay Payment ID</th>
                  <th className="px-4 py-3">Created Time</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                      {loadingBookings ? "Loading transactions..." : "No payment transactions found."}
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{b.id?.slice(0, 8)}...</td>
                      <td className="px-4 py-3 font-medium">{b.customers?.full_name || "Guest Customer"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.salons?.name || "Salon"}</td>
                      <td className="px-4 py-3 font-bold text-foreground">₹{b.total_amount || 0}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#2C73FF]/10 text-[#2C73FF]">
                          {b.payment_method?.toUpperCase() || "RAZORPAY"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          b.payment_status === "paid"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : b.payment_status === "failed" || b.status === "cancelled"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}>
                          {b.payment_status?.toUpperCase() || "PENDING"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {b.refund_status ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            b.refund_status === "refunded"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : b.refund_status === "processing"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : b.refund_status === "failed"
                              ? "bg-red-500/10 text-red-500"
                              : b.refund_status === "refund_requested"
                              ? "bg-purple-500/20 text-purple-400 animate-pulse"
                              : b.refund_status === "rescheduled"
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-muted/50 text-muted-foreground"
                          }`}>
                            {b.refund_status === "refunded" ? "✓ Refunded"
                              : b.refund_status === "processing" ? "⏳ Initiated"
                              : b.refund_status === "failed" ? "✗ Failed"
                              : b.refund_status === "refund_requested" ? "🚨 Escalated"
                              : b.refund_status === "rescheduled" ? "🔄 Rescheduled"
                              : b.refund_status === "pending_choice" ? "⌛ Pending Choice"
                              : b.refund_status}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {b.razorpay_order_id || "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {b.razorpay_payment_id || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {b.created_at ? new Date(b.created_at).toLocaleString("en-IN") : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {b.payment_status === "paid" && b.refund_status !== "refunded" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                              onClick={() => handleTriggerRefund(b.id)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Refund
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Platform Fee & Refund Configuration */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <IndianRupee className="h-5 w-5" /> Platform Fee & Pricing Rules
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="grid gap-2">
              <Label>REZ1 Booking Fee (₹)</Label>
              <Input type="number" value={config.bookingFee} onChange={e => setConfig(c => ({ ...c, bookingFee: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">Platform fee added to every booking</p>
            </div>
            <div className="grid gap-2">
              <Label>GST (%)</Label>
              <Input type="number" value={config.gstPercent} onChange={e => setConfig(c => ({ ...c, gstPercent: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">Applied on service total</p>
            </div>
            <div className="grid gap-2">
              <Label>Processing Loader Duration (seconds)</Label>
              <Input type="number" value={config.processingDuration} onChange={e => setConfig(c => ({ ...c, processingDuration: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">Duration of payment processing animation</p>
            </div>
            <div className="grid gap-2">
              <Label>Refund Window (hours)</Label>
              <Input type="number" value={config.refundWindowHours} onChange={e => setConfig(c => ({ ...c, refundWindowHours: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">Time limit for booking refund requests</p>
            </div>
          </div>
          <Button onClick={handleSavePricing} className="mt-2">Save Pricing Config</Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default PaymentsPage;
