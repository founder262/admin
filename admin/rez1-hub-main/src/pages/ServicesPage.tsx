import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Search, Plus, Pencil, Trash2, Percent, Store } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const ServicesPage = () => {
  const [salons, setSalons] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSalonId, setSelectedSalonId] = useState<string>("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  
  const [form, setForm] = useState({ salon_id: "", name: "", price: 0, duration: 0, offer_percent: 0, category: "" });

  const fetchSalons = async () => {
    const { data } = await supabase.from("salons").select("id, name").order("name");
    if (data) {
      setSalons(data);
      if (data.length > 0 && !selectedSalonId) {
        setSelectedSalonId(data[0].id);
      }
    }
  };

  const fetchServices = async (salonId: string) => {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("salon_id", salonId)
      .order("category");
    setServices(data || []);
  };

  useEffect(() => {
    fetchSalons();
  }, []);

  useEffect(() => {
    if (selectedSalonId) {
      fetchServices(selectedSalonId);
    }
  }, [selectedSalonId]);

  const filtered = services.filter(s =>
    (s.name || "").toLowerCase().includes(search.toLowerCase()) || 
    (s.category || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (service: any) => {
    setEditingService(service);
    setForm({ 
      salon_id: service.salon_id, 
      name: service.name, 
      price: service.price, 
      duration: service.duration, 
      offer_percent: service.offer_percent || 0, 
      category: service.category 
    });
    setShowEditor(true);
  };

  const handleAdd = () => {
    if (!selectedSalonId) {
      toast.error("Please select a salon first.");
      return;
    }
    setEditingService(null);
    setForm({ salon_id: selectedSalonId, name: "", price: 0, duration: 0, offer_percent: 0, category: "" });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.category.trim()) { 
      toast.error("Service name and category are required"); 
      return; 
    }
    
    if (editingService) {
      const { error } = await supabase.from("services").update(form).eq("id", editingService.id);
      if (error) toast.error("Failed to update service");
      else toast.success("Service updated");
    } else {
      const { error } = await supabase.from("services").insert(form);
      if (error) toast.error("Failed to create service");
      else toast.success("Service added");
    }
    
    setShowEditor(false);
    fetchServices(selectedSalonId);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this service?")) {
      await supabase.from("services").delete().eq("id", id);
      toast.success("Service deleted");
      fetchServices(selectedSalonId);
    }
  };

  const getDiscountedPrice = (price: number, offer: number) => {
    const val = price - (price * (offer || 0) / 100);
    return Math.max(0, Math.round(val));
  };
  
  const selectedSalonName = salons.find(s => s.id === selectedSalonId)?.name || "Selected Salon";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Services & Pricing</h1>
            <p className="text-muted-foreground mt-1">Manage services for each salon</p>
          </div>
          <Button onClick={handleAdd} disabled={!selectedSalonId}><Plus className="h-4 w-4 mr-2" />Add Service to {selectedSalonName}</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Left Column: Salon List */}
          <div className="col-span-1 space-y-2 max-h-[70vh] overflow-y-auto pr-2">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider sticky top-0 bg-background pt-1 pb-2">Select Salon</h3>
            {salons.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSalonId(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                  selectedSalonId === s.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-card-foreground border border-border hover:bg-muted"
                }`}
              >
                <Store className="h-4 w-4 shrink-0" />
                <span className="font-medium text-sm truncate">{s.name}</span>
              </button>
            ))}
            {salons.length === 0 && (
              <p className="text-xs text-muted-foreground pt-4">No salons available</p>
            )}
          </div>

          {/* Right Column: Services Table */}
          <div className="col-span-1 md:col-span-3 space-y-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={`Search services in ${selectedSalonName}...`} value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No services found for {selectedSalonName}.</p>
                  <Button variant="link" onClick={handleAdd} className="mt-2" disabled={!selectedSalonId}>Add the first service</Button>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Service</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Price</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Duration</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Offer</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Final Price</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(service => (
                      <tr key={service.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <span className="font-medium text-card-foreground text-sm">{service.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{service.category}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-card-foreground">₹{service.price}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{service.duration} min</td>
                        <td className="px-6 py-4">
                          {service.offer_percent > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded">
                              <Percent className="h-3 w-3" />{service.offer_percent}% OFF
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-card-foreground">
                          {service.offer_percent > 0 ? (
                            <span>
                              <span className="line-through text-muted-foreground font-normal mr-1">₹{service.price}</span>
                              ₹{getDiscountedPrice(service.price, service.offer_percent)}
                            </span>
                          ) : (
                            <span>₹{service.price}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(service)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(service.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Salon</Label>
              <Select value={form.salon_id} onValueChange={v => setForm(f => ({ ...f, salon_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select salon" /></SelectTrigger>
                <SelectContent>
                  {salons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Service Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Haircut" />
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Hair" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Price (₹)</Label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
              </div>
              <div className="grid gap-2">
                <Label>Duration (min)</Label>
                <Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))} />
              </div>
              <div className="grid gap-2">
                <Label>Offer %</Label>
                <Input type="number" min={0} max={100} value={form.offer_percent} onChange={e => setForm(f => ({ ...f, offer_percent: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ServicesPage;
