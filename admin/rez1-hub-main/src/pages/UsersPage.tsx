import AdminLayout from "@/components/AdminLayout";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Eye, Ban, UserCheck, Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { adminApi } from "@/utils/adminApi";

const UsersPage = () => {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchUsers = async () => {
    try {
      const data = await adminApi.fetch("customers", "*, bookings(id), customer_favorites(salons(name))");
      setUsers(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      fetchUsers();
      return;
    }
    try {
      const data = await adminApi.fetch("customers", "*, bookings(id), customer_favorites(salons(name))");
      const filtered = (data || []).filter((u: any) => 
        (u.full_name || "").toLowerCase().includes(query.toLowerCase()) || 
        (u.phone || "").includes(query)
      );
      setUsers(filtered);
    } catch (error) {
      console.error(error);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleToggleStatus = async (user: any) => {
    const newStatus = !user.is_active;
    try {
      await adminApi.update("customers", user.id, { is_active: newStatus });
      toast.success(`User marked as ${newStatus ? 'active' : 'inactive'}`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="text-muted-foreground mt-1">{users.length} registered users</p>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Contact</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Bookings</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Favorites</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <div className="h-9 w-9 rounded-full bg-muted overflow-hidden">
                          <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {user.full_name?.charAt(0) || "U"}
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-card-foreground text-sm">{user.full_name}</span>
                        <p className="text-xs text-muted-foreground">Joined {(new Date(user.joined_at)).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-muted-foreground">{user.phone}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-card-foreground font-medium">{user.bookings?.length || 0}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <Heart className="h-3.5 w-3.5 text-destructive fill-destructive" />{user.customer_favorites?.length || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4"><StatusBadge status={user.is_active ? "active" : "inactive"} /></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedUser(user); setShowDetail(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {user.is_active ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleToggleStatus(user)}>
                          <Ban className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success" onClick={() => handleToggleStatus(user)}>
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser?.full_name}</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground font-medium ml-1">{selectedUser.phone}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground font-medium ml-1">{selectedUser.email}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="ml-1"><StatusBadge status={selectedUser.is_active ? "active" : "inactive"} /></span></div>
                <div><span className="text-muted-foreground">Bookings:</span> <span className="text-foreground font-medium ml-1">{selectedUser.bookings?.length || 0}</span></div>
                <div><span className="text-muted-foreground">Joined:</span> <span className="text-foreground font-medium ml-1">{(new Date(selectedUser.joined_at)).toLocaleDateString()}</span></div>
                <div><span className="text-muted-foreground">Last Active:</span> <span className="text-foreground font-medium ml-1">{(new Date(selectedUser.last_active_at)).toLocaleDateString()}</span></div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Favorite Salons:</p>
                {selectedUser.customer_favorites?.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    {selectedUser.customer_favorites.map((fav: any) => (
                      <span key={fav.salons?.name} className="px-3 py-1 text-xs font-medium rounded-full bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                        <Heart className="h-3 w-3 fill-current" />{fav.salons?.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">No favorites yet</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default UsersPage;
