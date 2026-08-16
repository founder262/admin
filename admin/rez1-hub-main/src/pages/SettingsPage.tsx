import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { adminApi } from "@/utils/adminApi";
import { Switch } from "@/components/ui/switch";

const SettingsPage = () => {
  const navigate = useNavigate();
  const [globalConfig, setGlobalConfig] = useState({
    bookingFee: 25,
    maxDiscountCap: 90,
    defaultBufferMinutes: 10,
    maxBookingWindowDays: 7,
    maxPersonsPerBooking: 10,
    defaultSlotDuration: 30,
    promoAutoplaySpeed: 4,
    categoriesEnabled: true,
  });

  const [razorpayConfig, setRazorpayConfig] = useState({
    razorpay_enabled: true,
    razorpay_key_id: "",
    razorpay_key_secret: "",
    razorpay_webhook_secret: "",
    razorpay_env: "PROD",
  });

  const [adminProfile, setAdminProfile] = useState({
    name: "Founder",
    email: "founder@rez1.in"
  });

  // Stores the PK of the single platform_config row for targeted updates
  const [platformConfigId, setPlatformConfigId] = useState<string | null>(null);

  useEffect(() => {
    setAdminProfile({
      name: localStorage.getItem("rez1_admin_name") || "Admin",
      email: "founder@rez1.in"
    });

    const fetchConfig = async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select(
          "id, booking_fee, gst_percent, max_discount_cap, default_buffer_minutes, " +
          "max_booking_window_days, max_persons_per_booking, default_slot_duration, autoplay_speed_seconds, " +
          "razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret, categories_enabled"
        )
        .maybeSingle();

      const cfg = data as any;
      if (cfg) {
        setGlobalConfig({
          bookingFee: cfg.booking_fee ?? 25,
          maxDiscountCap: cfg.max_discount_cap ?? 90,
          defaultBufferMinutes: cfg.default_buffer_minutes ?? 10,
          maxBookingWindowDays: cfg.max_booking_window_days ?? 7,
          maxPersonsPerBooking: cfg.max_persons_per_booking ?? 10,
          defaultSlotDuration: cfg.default_slot_duration ?? 30,
          promoAutoplaySpeed: cfg.autoplay_speed_seconds ?? 4,
          categoriesEnabled: cfg.categories_enabled ?? true,
        });
        setRazorpayConfig({
          razorpay_enabled: true,
          razorpay_key_id: cfg.razorpay_key_id ?? "",
          razorpay_key_secret: cfg.razorpay_key_secret ?? "",
          razorpay_webhook_secret: cfg.razorpay_webhook_secret ?? "",
          razorpay_env: "PROD",
        });
        setPlatformConfigId(cfg.id);
      } else if (error) {
        console.warn("platform_config fetch error:", error.message);
      }
    };

    fetchConfig();
  }, []);

  const handleSaveConfig = async () => {
    const payload = {
      booking_fee: globalConfig.bookingFee,
      max_discount_cap: globalConfig.maxDiscountCap,
      default_buffer_minutes: globalConfig.defaultBufferMinutes,
      max_booking_window_days: globalConfig.maxBookingWindowDays,
      max_persons_per_booking: globalConfig.maxPersonsPerBooking,
      default_slot_duration: globalConfig.defaultSlotDuration,
      autoplay_speed_seconds: globalConfig.promoAutoplaySpeed,
      categories_enabled: globalConfig.categoriesEnabled,
    };

    let errorMsg = null;
    try {
      if (platformConfigId) {
        await adminApi.update("platform_config", platformConfigId, payload);
      } else {
        const res = await adminApi.insert("platform_config", payload);
        if (res && res.length > 0) setPlatformConfigId(res[0].id);
      }
    } catch (e: any) {
      errorMsg = e.message;
    }

    if (errorMsg) {
      toast.error("Failed to save configuration: " + errorMsg);
    } else {
      toast.success("Global configuration saved!");
    }
  };

  const handleSaveRazorpay = async () => {
    const payload = {
      razorpay_key_id: razorpayConfig.razorpay_key_id,
      razorpay_key_secret: razorpayConfig.razorpay_key_secret,
      razorpay_webhook_secret: razorpayConfig.razorpay_webhook_secret,
    };

    let errorMsg = null;
    try {
      if (platformConfigId) {
        await adminApi.update("platform_config", platformConfigId, payload);
      } else {
        const res = await adminApi.insert("platform_config", payload);
        if (res && res.length > 0) setPlatformConfigId(res[0].id);
      }
    } catch (e: any) {
      errorMsg = e.message;
    }

    if (errorMsg) {
      toast.error("Failed to save Razorpay settings: " + errorMsg);
    } else {
      toast.success("Razorpay configuration saved!");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("rez1_admin_logged_in");
    localStorage.removeItem("rez1_admin_id");
    localStorage.removeItem("rez1_admin_name");
    navigate("/login");
  };

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Admin profile & global configuration</p>
        </div>

        {/* Admin Profile */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-card-foreground">Admin Profile</h2>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input value={adminProfile.name} onChange={e => setAdminProfile({ ...adminProfile, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={adminProfile.email} readOnly className="bg-muted text-muted-foreground" />
            </div>
          </div>
          <Button onClick={async () => {
            const adminId = localStorage.getItem("rez1_admin_id");
            localStorage.setItem("rez1_admin_name", adminProfile.name);
            if (adminId) {
              try {
                await adminApi.update("admin_users", adminId, { full_name: adminProfile.name });
                toast.success("Profile updated!");
              } catch (err) {
                console.warn("DB profile save failed:", err);
                toast.success("Profile saved locally.");
              }
            } else {
              toast.success("Profile saved locally!");
            }
          }}>Save Changes</Button>
        </div>

        <Separator />

        {/* Global Configuration */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-card-foreground">Global Configuration</h2>
          <p className="text-sm text-muted-foreground">Platform-wide defaults applied to all salons and bookings.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>REZ1 Booking Fee (₹)</Label>
              <Input type="number" value={globalConfig.bookingFee} onChange={e => setGlobalConfig(c => ({ ...c, bookingFee: Number(e.target.value) }))} />
            </div>
            <div className="grid gap-2">
              <Label>Max Discount Cap (%)</Label>
              <Input type="number" value={globalConfig.maxDiscountCap} onChange={e => setGlobalConfig(c => ({ ...c, maxDiscountCap: Number(e.target.value) }))} />
            </div>
            <div className="grid gap-2">
              <Label>Default Buffer Time (min)</Label>
              <Input type="number" value={globalConfig.defaultBufferMinutes} onChange={e => setGlobalConfig(c => ({ ...c, defaultBufferMinutes: Number(e.target.value) }))} />
            </div>
            <div className="grid gap-2">
              <Label>Booking Window (days)</Label>
              <Input type="number" value={globalConfig.maxBookingWindowDays} onChange={e => setGlobalConfig(c => ({ ...c, maxBookingWindowDays: Number(e.target.value) }))} />
            </div>
            <div className="grid gap-2">
              <Label>Max Persons/Booking</Label>
              <Input type="number" value={globalConfig.maxPersonsPerBooking} onChange={e => setGlobalConfig(c => ({ ...c, maxPersonsPerBooking: Number(e.target.value) }))} />
            </div>
            <div className="grid gap-2">
              <Label>Default Slot Duration (min)</Label>
              <Input type="number" value={globalConfig.defaultSlotDuration} onChange={e => setGlobalConfig(c => ({ ...c, defaultSlotDuration: Number(e.target.value) }))} />
            </div>
            <div className="grid gap-2 col-span-2">
              <Label>Promo Banner Autoplay Speed (seconds)</Label>
              <Input type="number" value={globalConfig.promoAutoplaySpeed} onChange={e => setGlobalConfig(c => ({ ...c, promoAutoplaySpeed: Number(e.target.value) }))} />
            </div>
            <div className="grid gap-2 col-span-2 flex items-center justify-between border border-border p-3 rounded-lg mt-2 bg-muted/20">
              <div>
                <Label className="text-base font-semibold">Enable Customer Panel Categories</Label>
                <p className="text-xs text-muted-foreground">If disabled, the Category section in the Customer App will be hidden completely and all salons will show at once.</p>
              </div>
              <Switch
                checked={globalConfig.categoriesEnabled}
                onCheckedChange={checked => setGlobalConfig(c => ({ ...c, categoriesEnabled: checked }))}
              />
            </div>
          </div>
          <Button onClick={handleSaveConfig}>Save Configuration</Button>
        </div>

        <Separator />

        {/* Razorpay Gateway Configuration */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-6 animate-fade-in">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              💳 Razorpay Payment Gateway
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure your Razorpay Key ID, Key Secret, and Webhook Secret for live payment processing.
            </p>
            <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 space-y-1">
              <p className="font-semibold">📋 Razorpay Welcome Offer (Active for new merchants from 1 July 2026)</p>
              <p>✅ Zero transaction fees on first ₹5,00,000 GMV for 90 days from activation</p>
              <p>✅ No coupon code needed — Amount Credits applied automatically on KYC approval</p>
              <p>⚠️ Excludes: Prepaid Cards, Corporate Credit Cards, AMEX, Diners Club, and EMI-based payments</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="grid gap-2">
              <Label className="font-semibold">Razorpay Key ID <span className="text-xs text-muted-foreground">(starts with rzp_live_ or rzp_test_)</span></Label>
              <Input
                placeholder="rzp_live_xxxxxxxxxxxxxxxx"
                value={razorpayConfig.razorpay_key_id}
                onChange={e => setRazorpayConfig(c => ({ ...c, razorpay_key_id: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label className="font-semibold">Razorpay Key Secret</Label>
              <Input
                type="password"
                placeholder="Enter Key Secret from Razorpay Dashboard → Settings → API Keys"
                value={razorpayConfig.razorpay_key_secret}
                onChange={e => setRazorpayConfig(c => ({ ...c, razorpay_key_secret: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label className="font-semibold">Webhook Secret</Label>
              <Input
                type="password"
                placeholder="Enter Webhook Secret from Razorpay Dashboard → Settings → Webhooks"
                value={razorpayConfig.razorpay_webhook_secret}
                onChange={e => setRazorpayConfig(c => ({ ...c, razorpay_webhook_secret: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Webhook URL to register in Razorpay: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">https://[your-supabase-url]/functions/v1/razorpay-webhook</code>
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">🔗 Setup Instructions</p>
              <p>1. Login to <strong>dashboard.razorpay.com</strong> → Settings → API Keys → Generate Key</p>
              <p>2. Copy the <strong>Key ID</strong> and <strong>Key Secret</strong> above</p>
              <p>3. Go to Settings → Webhooks → Add New Webhook with the URL above</p>
              <p>4. Enable events: <code>payment.captured</code>, <code>payment.failed</code>, <code>refund.processed</code></p>
              <p>5. Copy the Webhook Secret into the field above and save</p>
            </div>
          </div>

          <Button onClick={handleSaveRazorpay}>Save Razorpay Settings</Button>
        </div>

        <Separator />

        {/* Danger Zone */}
        <div className="rounded-xl border border-destructive/20 bg-card p-6 space-y-4 animate-fade-in">
          <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
          <p className="text-sm text-muted-foreground">
            Clear local session and log out.
          </p>
          <Button variant="destructive" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SettingsPage;
