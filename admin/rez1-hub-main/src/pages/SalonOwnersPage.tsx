import AdminLayout from "@/components/AdminLayout";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Eye, KeyRound, Ban, ArrowUpDown, Shield, Star } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { adminApi } from "@/utils/adminApi";
import { supabase } from "@/lib/supabase";

const SalonOwnersPage = () => {
  const [search, setSearch] = useState("");
  const [salons, setSalons] = useState<any[]>([]);
  const [selectedSalon, setSelectedSalon] = useState<any | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [salonToSuspend, setSalonToSuspend] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const fetchSalons = async () => {
    try {
      const data = await adminApi.fetch("salons", "*, owners(*)");
      // Deduplicate: the DB may have legacy duplicate rows for the same owner.
      // Keep only the first (most recent, since API returns desc order) per owner_id.
      const seen = new Set<string>();
      const unique = (data || []).filter((s: any) => {
        const key = s.owner_id || s.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setSalons(unique);
    } catch (error: any) {
      console.error("Fetch error:", error);
    }
  };

  useEffect(() => {
    fetchSalons();
  }, []);

  const filtered = salons.filter(
    (o) =>
      (o.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.owners?.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = async (id: string, field: string, currentValue: boolean) => {
    try {
      await adminApi.update("salons", id, { [field]: !currentValue });
      toast.success("Salon setting updated");
      fetchSalons();
      
      const salon = salons.find(s => s.id === id);
      if (salon && salon.location_id) {
        await adminApi.syncLocationCount(salon.location_id);
      }
    } catch (error: any) {
      toast.error("Failed to update salon setting");
    }
  };

  const handlePlanChange = async (id: string, plan: "free" | "pro") => {
    try {
      await adminApi.update("salons", id, { subscription: plan });
      toast.success(`Plan changed to ${plan}`);
      fetchSalons();
    } catch (error: any) {
      toast.error("Failed to change plan");
    }
  };

  const handleStatusChangeRequest = (id: string, newStatus: "active" | "inactive") => {
    if (newStatus === "inactive") {
      setSalonToSuspend(id);
      setShowSuspendDialog(true);
    } else {
      unsuspendSalon(id);
    }
  };

  const suspendSalon = async () => {
    if (!salonToSuspend || !suspendReason.trim()) {
      toast.error("Please provide a suspension reason.");
      return;
    }
    try {
      await adminApi.update("salons", salonToSuspend, {
        is_suspended: true,
        suspension_reason: suspendReason
      });

      // BUG A5 FIX — Audit trail: insert a notification row so suspension is recorded
      const adminId = localStorage.getItem("rez1_admin_id") || null;
      const adminName = localStorage.getItem("rez1_admin_name") || "Admin";
      const suspendedSalon = salons.find(s => s.id === salonToSuspend);
      console.log(`[AUDIT] Salon suspended by admin ${adminName} (${adminId}):`, {
        salon_id: salonToSuspend,
        salon_name: suspendedSalon?.name,
        reason: suspendReason,
        suspended_at: new Date().toISOString(),
      });
      // Write audit notification for the owner
      await supabase.from("notifications").insert({
        title: "Your Salon Has Been Suspended",
        message: `Reason: ${suspendReason}. Please contact contact@rez1.in to resolve this.`,
        notif_type: "system",
        target_type: "broadcast_owners",
        sent_by_admin: adminId,
      }).then(({ error }) => {
        if (error) console.warn("Audit notification insert failed:", error.message);
      });

      toast.success("Salon suspended successfully. Owner notification queued.");
      setShowSuspendDialog(false);

      const salon = salons.find(s => s.id === salonToSuspend);
      if (salon && salon.location_id) {
        await adminApi.syncLocationCount(salon.location_id);
      }

      setSalonToSuspend(null);
      setSuspendReason("");
      fetchSalons();
    } catch (error: any) {
      toast.error("Failed to suspend salon");
    }
  };

  const unsuspendSalon = async (id: string) => {
    try {
      await adminApi.update("salons", id, {
        is_suspended: false,
        suspension_reason: null
      });
      toast.success("Salon reinstated successfully.");
      fetchSalons();

      const salon = salons.find(s => s.id === id);
      if (salon && salon.location_id) {
        await adminApi.syncLocationCount(salon.location_id);
      }
    } catch (error: any) {
      toast.error("Failed to reinstate salon");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Salon Owners</h1>
          <p className="text-muted-foreground mt-1">Manage approved salons and owners</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search salons or owners..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Salon & Owner</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Contact</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Plan</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((salon) => (
                <tr key={salon.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-card-foreground">{salon.name}</p>
                    <p className="text-xs text-muted-foreground">{salon.owners?.full_name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-card-foreground">{salon.owners?.email}</p>
                    <p className="text-xs text-muted-foreground">{salon.owners?.phone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Select
                      defaultValue={salon.subscription || "free"}
                      onValueChange={(val) => handlePlanChange(salon.id, val as any)}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-4">
                    <Select
                      value={salon.is_suspended ? "inactive" : "active"}
                      onValueChange={(val) => handleStatusChangeRequest(salon.id, val as any)}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedSalon(salon); setShowDetail(true); }}>
                      <Eye className="h-4 w-4 text-muted-foreground relative z-10" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    No salons found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspension Reason Dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={(open) => !open && setShowSuspendDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Salon Operations</DialogTitle>
            <DialogDescription>
              This will disable the salon's visibility and booking capabilities immediately. Please provide a reason to trigger an automated notification to the owner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Suspension</Label>
              <Textarea 
                placeholder="e.g., Reports of multiple no-shows, Violated terms of service..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuspendDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={suspendSalon}>Confirm Suspension</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between mt-4">
              <DialogTitle className="text-xl">{selectedSalon?.name}</DialogTitle>
              <StatusBadge status={selectedSalon?.is_suspended ? 'inactive' : 'active'} />
            </div>
            <DialogDescription>{selectedSalon?.address}</DialogDescription>
          </DialogHeader>

          {selectedSalon && (
            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details & Config</TabsTrigger>
                <TabsTrigger value="operations">Operations & Overrides</TabsTrigger>
                <TabsTrigger value="security">Security & Access</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Owner Name</Label>
                    <p className="text-sm font-medium">{selectedSalon.owners?.full_name}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Contact</Label>
                    <p className="text-sm font-medium">{selectedSalon.owners?.phone}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Categories</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedSalon.categories?.map((c: string) => (
                        <span key={c} className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">{c}</span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Rating</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                      <span className="text-sm font-medium">{selectedSalon.rating} ({selectedSalon.review_count})</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="operations" className="space-y-4 mt-4">
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-card-foreground">God-Mode Overrides</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">You are overriding the owner's internal configurations. Changes are instantly published.</p>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Force Emergency Mode</Label>
                        <p className="text-xs text-muted-foreground">Temporarily locks slots without suspension</p>
                      </div>
                      <Switch 
                        checked={selectedSalon.is_emergency_mode} 
                        onCheckedChange={() => handleToggle(selectedSalon.id, 'is_emergency_mode', selectedSalon.is_emergency_mode)} 
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>App Visibility</Label>
                        <p className="text-xs text-muted-foreground">Hides salon from search results</p>
                      </div>
                      <Switch 
                        checked={selectedSalon.is_visible} 
                        onCheckedChange={() => handleToggle(selectedSalon.id, 'is_visible', selectedSalon.is_visible)} 
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="security" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <Ban className="h-5 w-5" />
                      <h4 className="font-semibold">Suspend Operations</h4>
                    </div>
                    <p className="text-sm text-destructive/80 mb-4">
                      Immediately halts all bookings and hides from the public application. Owner receives alert.
                    </p>
                    <Button variant="destructive" className="w-full" onClick={() => handleStatusChangeRequest(selectedSalon.id, selectedSalon.is_suspended ? 'active' : 'inactive')}>
                      {selectedSalon.is_suspended ? 'Re-activate Salon' : 'Suspend Salon Now'}
                    </Button>
                  </div>
                  {selectedSalon.is_suspended && selectedSalon.suspension_reason && (
                    <div className="p-3 rounded bg-muted/80 text-sm">
                      <p className="font-semibold mb-1">Active Suspension Reason:</p>
                      <p className="text-muted-foreground">{selectedSalon.suspension_reason}</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default SalonOwnersPage;
