import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Smartphone, IndianRupee, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { adminApi } from "@/utils/adminApi";

const PaymentsPage = () => {
  const [phonepeConfig, setPhonepeConfig] = useState({
    enabled: true,
    env: "UAT", // UAT or PROD
    merchantId: "",
    saltKey: "",
    saltIndex: "1",
  });

  const [razorpayConfig, setRazorpayConfig] = useState({
    enabled: false,
    mode: "test",
    keyId: "",
    keySecret: "",
  });

  const [config, setConfig] = useState({
    bookingFee: 25,
    processingDuration: 2,
    gstPercent: 18,
    refundWindowHours: 24,
  });

  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await adminApi.fetch("platform_config", "*");
        if (data && data.length > 0) {
          const row = data[0];
          setConfigId(row.id);

          setPhonepeConfig({
            enabled: row.phonepe_enabled ?? true,
            env: row.phonepe_env ?? "UAT",
            merchantId: row.phonepe_merchant_id ?? "",
            saltKey: row.phonepe_salt_key ?? "",
            saltIndex: row.phonepe_salt_index ?? "1",
          });

          setRazorpayConfig({
            enabled: row.razorpay_enabled ?? false,
            mode: row.razorpay_mode ?? 'test',
            keyId: row.razorpay_key_id ?? '',
            keySecret: row.razorpay_key_secret ?? '',
          });

          setConfig({
            bookingFee: row.booking_fee ?? 25,
            processingDuration: row.default_buffer_minutes ?? 10,
            gstPercent: row.gst_percent ?? 18,
            refundWindowHours: row.refund_window_hours ?? 24,
          });
        }
      } catch (error) {
        console.error("Config fetch error:", error);
      }
    };
    fetchConfig();
  }, []);

  const handleSavePhonePe = async () => {
    try {
      const payload = {
        phonepe_enabled: phonepeConfig.enabled,
        phonepe_env: phonepeConfig.env,
        phonepe_merchant_id: phonepeConfig.merchantId,
        phonepe_salt_key: phonepeConfig.saltKey,
        phonepe_salt_index: phonepeConfig.saltIndex,
      };
      if (configId) {
        await adminApi.update("platform_config", configId, payload);
      } else {
        await adminApi.insert("platform_config", payload);
      }
      toast.success("PhonePe Gateway configuration saved");
    } catch (error) {
      toast.error("Failed to save PhonePe config");
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
      toast.success("Fee configuration saved");
    } catch (error) {
      toast.error("Failed to save pricing config");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Configuration</h1>
          <p className="text-muted-foreground mt-1">Manage payment gateways & fee settings</p>
        </div>

        {/* PhonePe Gateway Configuration */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" /> PhonePe Payment Gateway
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Configure PhonePe credentials for customer checkout.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{phonepeConfig.enabled ? "Enabled" : "Disabled"}</span>
              <Switch checked={phonepeConfig.enabled} onCheckedChange={v => setPhonepeConfig(prev => ({ ...prev, enabled: v }))} />
            </div>
          </div>
          
          {phonepeConfig.enabled && (
             <div className="pt-4 border-t border-border grid grid-cols-2 gap-6 animate-fade-in">
               <div className="grid gap-2 col-span-2">
                 <Label>Environment Mode</Label>
                 <div className="flex items-center gap-4">
                   <Button variant={phonepeConfig.env === "UAT" ? "default" : "outline"} onClick={() => setPhonepeConfig(p => ({ ...p, env: "UAT" }))} size="sm">UAT Sandbox</Button>
                   <Button variant={phonepeConfig.env === "PROD" ? "default" : "outline"} onClick={() => setPhonepeConfig(p => ({ ...p, env: "PROD" }))} size="sm">Production (Live)</Button>
                 </div>
               </div>
               <div className="grid gap-2">
                 <Label>Merchant ID</Label>
                 <Input value={phonepeConfig.merchantId} onChange={e => setPhonepeConfig(c => ({ ...c, merchantId: e.target.value }))} placeholder="PGTESTPAYUAT or M123456..." />
               </div>
               <div className="grid gap-2">
                 <Label>Salt Index</Label>
                 <Input value={phonepeConfig.saltIndex} onChange={e => setPhonepeConfig(c => ({ ...c, saltIndex: e.target.value }))} placeholder="1" />
               </div>
               <div className="grid gap-2 col-span-2">
                 <Label>Salt Key</Label>
                 <Input type="password" value={phonepeConfig.saltKey} onChange={e => setPhonepeConfig(c => ({ ...c, saltKey: e.target.value }))} placeholder="••••••••-••••-••••-••••-••••••••••••" />
               </div>
               <div className="col-span-2">
                 <Button onClick={handleSavePhonePe} className="w-full">Save PhonePe Gateway Settings</Button>
               </div>
             </div>
          )}
        </div>

        {/* Fee Configuration */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <IndianRupee className="h-5 w-5" /> Fee & Pricing Configuration
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
