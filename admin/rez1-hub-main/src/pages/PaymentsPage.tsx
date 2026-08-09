import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Smartphone, IndianRupee, RefreshCw, CheckCircle2, XCircle, 
  RotateCcw, ArrowUpRight, Search, FileText, Lock
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { adminApi } from "@/utils/adminApi";

import { supabase } from "@/lib/supabase";

const PaymentsPage = () => {
  const [phonepeConfig, setPhonepeConfig] = useState({
    enabled: true,
    env: "UAT", // UAT or PROD
    merchantId: "",
    clientId: "",
    clientSecret: "",
    clientVersion: "1",
    webhookUrl: "https://api.rez1.in/api/payments/phonepe/webhook",
    webhookUsername: "",
    webhookPassword: "",
    successUrl: "https://rez1.in/payment/success",
    failureUrl: "https://rez1.in/payment/failed",
    cancelUrl: "https://rez1.in/payment/cancel",
    saltKey: "",
    saltIndex: "1",
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

        setPhonepeConfig({
          enabled: row.phonepe_enabled ?? true,
          env: row.phonepe_env ?? "UAT",
          merchantId: row.phonepe_merchant_id ?? "",
          clientId: row.phonepe_client_id ?? "",
          clientSecret: row.phonepe_client_secret ?? "",
          clientVersion: row.phonepe_client_version ?? "1",
          webhookUrl: row.phonepe_webhook_url ?? "https://api.rez1.in/api/payments/phonepe/webhook",
          webhookUsername: row.phonepe_webhook_username ?? "",
          webhookPassword: row.phonepe_webhook_password ?? "",
          successUrl: row.phonepe_success_url ?? "https://rez1.in/payment/success",
          failureUrl: row.phonepe_failure_url ?? "https://rez1.in/payment/failed",
          cancelUrl: row.phonepe_cancel_url ?? "https://rez1.in/payment/cancel",
          saltKey: row.phonepe_salt_key ?? "",
          saltIndex: row.phonepe_salt_index ?? "1",
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

  const handleSavePhonePe = async () => {
    try {
      const payload = {
        phonepe_enabled: phonepeConfig.enabled,
        phonepe_env: phonepeConfig.env,
        phonepe_merchant_id: phonepeConfig.merchantId,
        phonepe_client_id: phonepeConfig.clientId,
        phonepe_client_secret: phonepeConfig.clientSecret,
        phonepe_client_version: phonepeConfig.clientVersion,
        phonepe_webhook_url: phonepeConfig.webhookUrl,
        phonepe_webhook_username: phonepeConfig.webhookUsername,
        phonepe_webhook_password: phonepeConfig.webhookPassword,
        phonepe_success_url: phonepeConfig.successUrl,
        phonepe_failure_url: phonepeConfig.failureUrl,
        phonepe_cancel_url: phonepeConfig.cancelUrl,
        phonepe_salt_key: phonepeConfig.saltKey,
        phonepe_salt_index: phonepeConfig.saltIndex,
      };

      if (configId) {
        await adminApi.update("platform_config", configId, payload);
      } else {
        await adminApi.insert("platform_config", payload);
      }
      toast.success("PhonePe Payment Gateway configuration saved successfully!");
    } catch (error: any) {
      toast.error("Failed to save PhonePe config: " + (error.message || "Unknown error"));
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
      b.phonepe_transaction_id?.toLowerCase().includes(term) ||
      b.phonepe_merchant_transaction_id?.toLowerCase().includes(term) ||
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
            Manage PhonePe Client ID / Credentials configuration, inspect transaction logs, and process refunds.
          </p>
        </div>

        {/* Phase 8 – Analytics Dashboard Cards */}
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

        {/* Phase 1 – PhonePe Payment Gateway Configuration */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" /> PhonePe Payment Gateway Architecture
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure Client Credentials (Client ID, Client Secret & Client Version) for PhonePe v1/v2 Standard Checkout.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{phonepeConfig.enabled ? "Enabled" : "Disabled"}</span>
              <Switch checked={phonepeConfig.enabled} onCheckedChange={v => setPhonepeConfig(prev => ({ ...prev, enabled: v }))} />
            </div>
          </div>
          
          {phonepeConfig.enabled && (
             <div className="pt-4 border-t border-border space-y-6 animate-fade-in">
               {/* Environment selection */}
               <div className="grid gap-2">
                 <Label className="font-semibold">Environment</Label>
                 <div className="flex items-center gap-4">
                   <Button 
                     type="button"
                     variant={phonepeConfig.env === "UAT" ? "default" : "outline"} 
                     onClick={() => setPhonepeConfig(p => ({ ...p, env: "UAT" }))} 
                     size="sm"
                   >
                     Sandbox (UAT Test Mode)
                   </Button>
                   <Button 
                     type="button"
                     variant={phonepeConfig.env === "PROD" ? "default" : "outline"} 
                     onClick={() => setPhonepeConfig(p => ({ ...p, env: "PROD" }))} 
                     size="sm"
                   >
                     Production (Live)
                   </Button>
                 </div>
               </div>

               {/* Client Credentials & Merchant Information */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="grid gap-2">
                   <Label className="font-semibold">Merchant ID</Label>
                   <Input 
                     value={phonepeConfig.merchantId} 
                     onChange={e => setPhonepeConfig(c => ({ ...c, merchantId: e.target.value }))} 
                     placeholder="M221F6V1RTPZ6" 
                   />
                 </div>
                 <div className="grid gap-2">
                   <Label className="font-semibold">Client ID</Label>
                   <Input 
                     value={phonepeConfig.clientId} 
                     onChange={e => setPhonepeConfig(c => ({ ...c, clientId: e.target.value }))} 
                     placeholder="SU2607281522118831940246" 
                   />
                 </div>
                 <div className="grid gap-2">
                   <Label className="font-semibold">Client Secret</Label>
                   <Input 
                     type="password"
                     value={phonepeConfig.clientSecret} 
                     onChange={e => setPhonepeConfig(c => ({ ...c, clientSecret: e.target.value }))} 
                     placeholder="Enter Client Secret from PhonePe Developer Settings" 
                   />
                 </div>
                 <div className="grid gap-2">
                   <Label className="font-semibold">Client Version</Label>
                   <Input 
                     value={phonepeConfig.clientVersion} 
                     onChange={e => setPhonepeConfig(c => ({ ...c, clientVersion: e.target.value }))} 
                     placeholder="1" 
                   />
                 </div>
               </div>

               {/* Webhook & Callback Configuration */}
               <div className="space-y-4 pt-4 border-t border-border">
                 <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                   <Lock className="h-4 w-4 text-primary" /> Webhooks & Callback Endpoints
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="grid gap-2 md:col-span-2">
                     <Label>Webhook URL</Label>
                     <Input 
                       value={phonepeConfig.webhookUrl} 
                       onChange={e => setPhonepeConfig(c => ({ ...c, webhookUrl: e.target.value }))} 
                       placeholder="https://api.rez1.in/api/payments/phonepe/webhook" 
                     />
                   </div>
                   <div className="grid gap-2">
                     <Label>Webhook Username</Label>
                     <Input 
                       value={phonepeConfig.webhookUsername} 
                       onChange={e => setPhonepeConfig(c => ({ ...c, webhookUsername: e.target.value }))} 
                       placeholder="rez1_webhook_user" 
                     />
                   </div>
                   <div className="grid gap-2">
                     <Label>Webhook Password</Label>
                     <Input 
                       type="password"
                       value={phonepeConfig.webhookPassword} 
                       onChange={e => setPhonepeConfig(c => ({ ...c, webhookPassword: e.target.value }))} 
                       placeholder="••••••••••••••••" 
                     />
                   </div>
                   <div className="grid gap-2">
                     <Label>Success URL</Label>
                     <Input 
                       value={phonepeConfig.successUrl} 
                       onChange={e => setPhonepeConfig(c => ({ ...c, successUrl: e.target.value }))} 
                       placeholder="https://rez1.in/payment/success" 
                     />
                   </div>
                   <div className="grid gap-2">
                     <Label>Failure URL</Label>
                     <Input 
                       value={phonepeConfig.failureUrl} 
                       onChange={e => setPhonepeConfig(c => ({ ...c, failureUrl: e.target.value }))} 
                       placeholder="https://rez1.in/payment/failed" 
                     />
                   </div>
                   <div className="grid gap-2 md:col-span-2">
                     <Label>Cancel URL</Label>
                     <Input 
                       value={phonepeConfig.cancelUrl} 
                       onChange={e => setPhonepeConfig(c => ({ ...c, cancelUrl: e.target.value }))} 
                       placeholder="https://rez1.in/payment/cancel" 
                     />
                   </div>
                 </div>
               </div>

               <Button onClick={handleSavePhonePe} className="w-full md:w-auto">
                 Save PhonePe Configuration
               </Button>
             </div>
          )}
        </div>

        {/* Phase 8 – Payment Transactions Table */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Payment Transactions</h2>
              <p className="text-sm text-muted-foreground">Detailed logs of customer bookings, PhonePe transaction IDs & statuses.</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transaction, booking, or customer..."
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
                  <th className="px-4 py-3">PhonePe Txn ID</th>
                  <th className="px-4 py-3">Merchant Order ID</th>
                  <th className="px-4 py-3">Created Time</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                      No payment transactions found.
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
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">
                          {b.payment_method?.toUpperCase() || "PHONEPE"}
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
                        {b.phonepe_transaction_id || "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {b.phonepe_merchant_transaction_id || b.id?.slice(0, 10) || "-"}
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

