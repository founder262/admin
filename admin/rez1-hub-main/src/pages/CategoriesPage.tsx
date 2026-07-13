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
import { Search, Tag, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { adminApi } from "@/utils/adminApi";

const CategoriesPage = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  
  // Form State
  const [catName, setCatName] = useState("");
  const [catActive, setCatActive] = useState(true);

  const fetchCategories = async () => {
    try {
      const data = await adminApi.fetch("categories");
      setCategories(data || []);
    } catch (error: any) {
      console.error("Fetch categories error:", error);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const filtered = categories.filter((cat) =>
    (cat.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAddCategory = async () => {
    if (!catName.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      await adminApi.insert("categories", { 
        name: catName.trim(), 
        is_active: catActive 
      });
      toast.success("New category added successfully.");
      closeDialog();
      fetchCategories();
    } catch (error: any) {
      toast.error("Category likely already exists or an error occurred.");
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      await adminApi.update("categories", id, { is_active: !currentActive });
      toast.success("Category visibility toggled.");
      fetchCategories();
    } catch (error: any) {
      toast.error("Failed to toggle category");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to remove this category? This permanently deletes it from the platform.")) {
      try {
        await adminApi.delete("categories", id);
        toast.success("Category removed from system.");
        fetchCategories();
      } catch (error: any) {
        toast.error("Failed to delete category");
      }
    }
  };

  const openAdd = () => {
    setCatName("");
    setCatActive(true);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setCatName("");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Global Categories</h1>
            <p className="text-muted-foreground mt-1">Manage salon categories for the Customer App</p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search category..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-10" 
          />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Category Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">App Visibility</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cat) => (
                <tr key={cat.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Tag className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-card-foreground">{cat.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Switch 
                      checked={cat.is_active} 
                      onCheckedChange={() => handleToggle(cat.id, cat.is_active)} 
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive" 
                      title="Delete" 
                      onClick={() => handleDelete(cat.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                    No categories found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2 relative">
              <Label>Category Name</Label>
              <Input 
                placeholder="e.g. Spa, Haircut, Facial..." 
                value={catName} 
                onChange={(e) => setCatName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">This name appears as a filter tab in the Customer App.</p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <Label className="text-base">Visible in Customer Panel</Label>
                <p className="text-xs text-muted-foreground">Toggle off to hide this category temporarily</p>
              </div>
              <Switch checked={catActive} onCheckedChange={setCatActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleAddCategory}>Create Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default CategoriesPage;
