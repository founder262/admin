import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Megaphone, Send, Search, Tag, CalendarDays, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const typeIcons: Record<string, JSX.Element> = {
  promo: <Tag className="h-4 w-4 text-destructive" />,
  system: <AlertTriangle className="h-4 w-4 text-warning" />,
  booking: <CalendarDays className="h-4 w-4 text-primary" />,
};

const typeColors: Record<string, string> = {
  promo: "bg-destructive/10 text-destructive border-destructive/20",
  system: "bg-warning/10 text-warning border-warning/20",
  booking: "bg-primary/10 text-primary border-primary/20",
};

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({
    title: "",
    message: "",
    notif_type: "promo",
    target_type: "broadcast_customers", // BUG A2 FIX — use valid DB constraint value
  });

  // Fetch notifications securely via admin-api proxy
  const fetchNotifications = async () => {
    try {
      const { data: res, error } = await supabase.functions.invoke('admin-api', {
        body: {
          action: 'SELECT',
          table: 'notifications',
          query: '*',
          orderBy: { column: 'created_at', ascending: false }
        }
      });

      if (res?.success) {
        // filter client-side to only show relevant broadcast targets
        const list = res.data || [];
        const filteredList = list.filter((n: any) =>
          ["broadcast_customers", "broadcast_owners", "broadcast_all"].includes(n.target_type)
        );
        setNotifications(filteredList);
      } else {
        console.error("fetchNotifications error:", res?.error || error);
        toast.error("Failed to load notifications from database");
      }
    } catch (err) {
      console.error("fetchNotifications error:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const filtered = notifications.filter(n =>
    (n.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (n.message || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async () => {
    if (!composeForm.title.trim() || !composeForm.message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    
    const adminId = localStorage.getItem("rez1_admin_id");

    const payload = {
      title: composeForm.title,
      message: composeForm.message,
      notif_type: composeForm.notif_type,
      target_type: composeForm.target_type,
      sent_by_admin: adminId || null,
    };

    try {
      const { data: res, error } = await supabase.functions.invoke('admin-api', {
        body: {
          action: 'INSERT',
          table: 'notifications',
          data: payload
        }
      });

      if (error || !res?.success) {
        toast.error(res?.error?.message || error?.message || "Failed to send notification.");
        return;
      }

      toast.success(`Notification sent to ${composeForm.target_type.replace(/_/g, ' ')}`);
      setShowCompose(false);
      setComposeForm({ title: "", message: "", notif_type: "promo", target_type: "broadcast_customers" });
      fetchNotifications();
    } catch (err: any) {
      toast.error(err.message || "An error occurred while sending the notification.");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notification Center</h1>
            <p className="text-muted-foreground mt-1">Manage broadcast & direct alerts</p>
          </div>
          <Button onClick={() => setShowCompose(true)}>
            <Megaphone className="h-4 w-4 mr-2" />Compose
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search notifications..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="promo">Promo</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="booking">Booking</TabsTrigger>
          </TabsList>

          {["all", "promo", "system", "booking"].map(tab => (
            <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
              {filtered
                .filter(n => tab === "all" || n.notif_type === tab)
                .map(notif => {
                  const typeKey = notif.notif_type || "system";
                  return (
                  <div key={notif.id} className="rounded-xl border border-border bg-card p-4 flex items-start gap-4 animate-fade-in">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${typeColors[typeKey]?.split(" ")[0] || "bg-muted"}`}>
                      {typeIcons[typeKey]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-card-foreground text-sm">{notif.title}</p>
                        <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border ${typeColors[typeKey] || "border-border"}`}>{typeKey}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{new Date(notif.created_at).toLocaleString()}</span>
                        <span className="capitalize">Target: {notif.target_type.replace('_', ' ')}</span>
                        <span>Read: {notif.read_count || 0}/{notif.total_recipients || 0}</span>
                      </div>
                    </div>
                  </div>
                )})}
                {filtered.filter(n => tab === "all" || n.notif_type === tab).length === 0 && (
                  <p className="text-sm text-muted-foreground pt-4">No broadcast notifications found.</p>
                )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Compose Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input value={composeForm.title} onChange={e => setComposeForm(f => ({ ...f, title: e.target.value }))} placeholder="Notification title..." />
            </div>
            <div className="grid gap-2">
              <Label>Message</Label>
              <Textarea value={composeForm.message} onChange={e => setComposeForm(f => ({ ...f, message: e.target.value }))} placeholder="Notification body..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={composeForm.notif_type} onValueChange={v => setComposeForm(f => ({ ...f, notif_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="promo">Promo</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="booking">Booking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Target Audience</Label>
                <Select value={composeForm.target_type} onValueChange={v => setComposeForm(f => ({ ...f, target_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  {/* BUG A2 FIX — values must match DB check constraint */}
                  <SelectContent>
                    <SelectItem value="broadcast_customers">All Customers</SelectItem>
                    <SelectItem value="broadcast_owners">All Salon Owners</SelectItem>
                    <SelectItem value="broadcast_all">Everyone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button>
            <Button onClick={handleSend}><Send className="h-4 w-4 mr-2" />Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default NotificationsPage;
