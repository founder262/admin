import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Image, Video, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const PromotionsPage = () => {
  const [slides, setSlides] = useState<any[]>([]);
  const [autoplaySpeed, setAutoplaySpeed] = useState(4);
  const [showEditor, setShowEditor] = useState(false);
  const [editingSlide, setEditingSlide] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [form, setForm] = useState<any>({ 
    title: "", 
    media_type: "image", 
    media_url: "", 
    redirect_type: "salon", 
    redirect_value: "", 
    is_active: true, 
    start_date: "", 
    end_date: "" 
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchBanners = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-api", {
      body: {
        action: "SELECT",
        table: "promo_banners",
        query: "*",
        orderBy: { column: "display_order", ascending: true }
      }
    });
    setSlides(data?.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleToggle = async (id: string, currentActive: boolean) => {
      const { data, error } = await supabase.functions.invoke("admin-api", {
        body: { action: "UPDATE", table: "promo_banners", data: { is_active: !currentActive }, id }
      });
      if (error || !data?.success) {
        toast.error(`Failed to update status`);
        return;
      }
    toast.success("Slide status updated");
    fetchBanners();
  };

  const handleDelete = async (id: string) => {
      const { data, error } = await supabase.functions.invoke("admin-api", {
        body: { action: "DELETE", table: "promo_banners", id }
      });
      if (error || !data?.success) {
        toast.error(`Failed to delete slide`);
        return;
      }
    toast.success("Slide deleted");
    fetchBanners();
  };

  const handleEdit = (slide: any) => {
    setEditingSlide(slide);
    setForm({ 
      title: slide.title, 
      media_type: slide.media_type, 
      media_url: slide.media_url, 
      redirect_type: slide.redirect_type, 
      redirect_value: slide.redirect_value, 
      is_active: slide.is_active, 
      start_date: slide.start_date || "", 
      end_date: slide.end_date || "" 
    });
    setSelectedFile(null);
    setShowEditor(true);
  };

  const handleAdd = (type: "image" | "video") => {
    setEditingSlide(null);
    setSelectedFile(null);
    setForm({ 
      title: "", 
      media_type: type, 
      media_url: "", 
      redirect_type: "category", 
      redirect_value: "", 
      is_active: true, 
      start_date: "", 
      end_date: "" 
    });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    
    let finalUrl = form.media_url;

    if (selectedFile) {
      const fileName = `${Date.now()}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
      
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("bucket", "promo-media");
      formData.append("path", fileName);

      const { data, error } = await supabase.functions.invoke("upload-image", {
        body: formData,
      });

      if (error || data?.error) {
        toast.error(`Failed to upload media: ${error?.message || data?.error}`);
        return;
      }
      
      finalUrl = data.url;
    }

    if (!finalUrl) {
      toast.error("Media is required");
      return;
    }

    const payload = {
      title: form.title,
      media_type: form.media_type,
      media_url: finalUrl,
      redirect_type: form.redirect_type,
      redirect_value: form.redirect_value,
      is_active: form.is_active,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      display_order: editingSlide ? editingSlide.display_order : slides.length
    };

    if (editingSlide) {
      const { data, error } = await supabase.functions.invoke("admin-api", {
        body: { action: "UPDATE", table: "promo_banners", data: payload, id: editingSlide.id }
      });
      if (error || !data?.success) {
        toast.error(`Failed to update slide: ${error?.message || data?.error?.message}`);
        return;
      }
      toast.success("Slide updated");
    } else {
      const { data, error } = await supabase.functions.invoke("admin-api", {
        body: { action: "INSERT", table: "promo_banners", data: payload }
      });
      if (error || !data?.success) {
        toast.error(`Failed to add slide: ${error?.message || data?.error?.message}`);
        return;
      }
      toast.success("Slide added");
    }
    
    setShowEditor(false);
    fetchBanners();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Promotional Ads</h1>
            <p className="text-muted-foreground mt-1">Manage homepage carousel banners</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleAdd("video")}><Video className="h-4 w-4 mr-2" />Add Video</Button>
            <Button onClick={() => handleAdd("image")}><Image className="h-4 w-4 mr-2" />Add Poster</Button>
          </div>
        </div>

        {/* Autoplay Config */}
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium">Autoplay Speed</Label>
            <Input
              type="number"
              min={1}
              max={15}
              value={autoplaySpeed}
              onChange={e => setAutoplaySpeed(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">seconds</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.success(`Autoplay config is managed in SettingsPage.This is a local preview.`)}>Apply Preview</Button>
        </div>

        {/* Slides List */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 animate-pulse">Loading banners...</p>
          ) : slides.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No banners configured. Click "Add Poster" or "Add Video" to create one.</p>
          ) : (
            slides.map(slide => (
              <div key={slide.id} className="rounded-xl border border-border bg-card p-4 flex items-start gap-4 animate-fade-in">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab shrink-0 mt-1" />
                {/* Thumbnail */}
                <div className="h-20 w-32 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden relative">
                  {slide.media_type === 'video' ? (
                    <>
                      <video
                        src={slide.media_url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video className="h-6 w-6 text-white" />
                      </div>
                    </>
                  ) : (
                    <img
                      src={slide.media_url}
                      alt={slide.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  )}
                  {slide.media_type !== 'video' && (
                    <div className="hidden absolute inset-0 flex-col items-center justify-center gap-1 text-center px-1">
                      <Image className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground">No preview</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-card-foreground text-sm truncate">{slide.title}</p>
                    {(() => {
                      const today = new Date().toISOString().split('T')[0];
                      const isExpired = slide.end_date && slide.end_date < today;
                      return isExpired ? (
                        <span className="bg-destructive/10 text-destructive border border-destructive/20 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">Expired</span>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="capitalize border px-1.5 rounded">{slide.media_type}</span>
                    <span>Redirect: <span className="capitalize">{slide.redirect_type}</span> → {slide.redirect_value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Duration: {slide.start_date || 'Always'} to {slide.end_date || 'Always'}</p>
                  {/* Clickable URL for debugging */}
                  <a
                    href={slide.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary hover:underline mt-1 block truncate"
                    onClick={e => e.stopPropagation()}
                  >
                    {slide.media_url}
                  </a>
                </div>
                <Switch checked={slide.is_active} onCheckedChange={() => handleToggle(slide.id, slide.is_active)} />
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(slide)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(slide.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSlide ? "Edit Slide" : "Add New Slide"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="Slide title..." />
              </div>
              <div className="grid gap-2">
                <Label>Media Type</Label>
                <Select value={form.media_type} onValueChange={v => setForm((f: any) => ({ ...f, media_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Poster Image</SelectItem>
                    <SelectItem value="video">Video (Max 5-6s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 col-span-2">
              <Label>Upload Media ({form.media_type === "video" ? "Video max 5-6s" : "Poster Image"})</Label>
              <Input 
                type="file" 
                accept={form.media_type === "video" ? "video/*" : "image/*"} 
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    // Local preview
                    setForm((f: any) => ({ ...f, media_url: URL.createObjectURL(file) }));
                  }
                }} 
              />
              {selectedFile && <p className="text-xs text-success mt-1">File ready to upload.</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm((f: any) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm((f: any) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Redirect Type</Label>
                <Select value={form.redirect_type} onValueChange={v => setForm((f: any) => ({ ...f, redirect_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salon">Salon</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="url">External URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Redirect Value</Label>
                <Input value={form.redirect_value} onChange={e => setForm((f: any) => ({ ...f, redirect_value: e.target.value }))} placeholder="Salon ID / Category / URL" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm((f: any) => ({ ...f, is_active: v }))} />
              <Label>Active</Label>
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

export default PromotionsPage;
