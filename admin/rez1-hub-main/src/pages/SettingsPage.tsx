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

  const [phonepeConfig, setPhonepeConfig] = useState({
    phonepe_enabled: true,
    phonepe_env: "UAT",
    phonepe_merchant_id: "",
    phonepe_salt_key: "",
    phonepe_salt_index: "1",
  });

  const [adminProfile, setAdminProfile] = useState({
    name: "Founder",
    email: "founder@rez1.in"
  });

  // Stores the PK of the single platform_config row for targeted updates
  const [platformConfigId, setPlatformConfigId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch profile from localStorage (DB save added below)
    const adminId = localStorage.getItem("rez1_admin_id");
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
          "phonepe_enabled, phonepe_env, phonepe_merchant_id, phonepe_salt_key, phonepe_salt_index, categories_enabled"
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
        setPhonepeConfig({
          phonepe_enabled: cfg.phonepe_enabled ?? true,
          phonepe_env: cfg.phonepe_env ?? "UAT",
          phonepe_merchant_id: cfg.phonepe_merchant_id ?? "",
          phonepe_salt_key: cfg.phonepe_salt_key ?? "",
          phonepe_salt_index: cfg.phonepe_salt_index ?? "1",
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

  const handleSavePhonePe = async () => {
    const payload = {
      phonepe_enabled: phonepeConfig.phonepe_enabled,
      phonepe_env: phonepeConfig.phonepe_env,
      phonepe_merchant_id: phonepeConfig.phonepe_merchant_id,
      phonepe_salt_key: phonepeConfig.phonepe_salt_key,
      phonepe_salt_index: phonepeConfig.phonepe_salt_index,
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
      toast.error("Failed to save PhonePe settings: " + errorMsg);
    } else {
      toast.success("PhonePe configuration saved!");
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
                console.warn("DB profile save failed (check RLS policy on admin_users):", err);
                toast.success("Profile saved locally. (DB update requires RLS policy — see guide)");
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

        {/* PhonePe Gateway Configuration */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-6 animate-fade-in">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">PhonePe Payment Gateway</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure PhonePe credentials for customer checkout payments and automated refund processing.
            </p>
          </div>
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="phonepe-enabled"
                checked={phonepeConfig.phonepe_enabled}
                onChange={e => setPhonepeConfig(c => ({ ...c, phonepe_enabled: e.target.checked }))}
                className="h-4 w-4 rounded accent-primary"
              />
              <Label htmlFor="phonepe-enabled">Enable PhonePe Payments</Label>
            </div>
            <div className="grid gap-2">
              <Label>Environment Mode</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant={phonepeConfig.phonepe_env === "UAT" ? "default" : "outline"}
                  onClick={() => setPhonepeConfig(c => ({ ...c, phonepe_env: "UAT" }))}
                  size="sm"
                >
                  UAT Sandbox
                </Button>
                <Button
                  type="button"
                  variant={phonepeConfig.phonepe_env === "PROD" ? "default" : "outline"}
                  onClick={() => setPhonepeConfig(c => ({ ...c, phonepe_env: "PROD" }))}
                  size="sm"
                >
                  Production (Live)
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Merchant ID</Label>
              <Input
                placeholder="PGTESTPAYUAT or M123456789"
                value={phonepeConfig.phonepe_merchant_id}
                onChange={e => setPhonepeConfig(c => ({ ...c, phonepe_merchant_id: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Salt Key <span className="text-muted-foreground text-xs">(used server-side for payload hashing)</span></Label>
              <Input
                type="password"
                placeholder="••••••••-••••-••••-••••-••••••••••••"
                value={phonepeConfig.phonepe_salt_key}
                onChange={e => setPhonepeConfig(c => ({ ...c, phonepe_salt_key: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Salt Index</Label>
              <Input
                placeholder="1"
                value={phonepeConfig.phonepe_salt_index}
                onChange={e => setPhonepeConfig(c => ({ ...c, phonepe_salt_index: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={handleSavePhonePe}>Save PhonePe Settings</Button>
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
