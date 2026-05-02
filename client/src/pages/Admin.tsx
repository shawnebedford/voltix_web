import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Plus,
  ToggleLeft,
  ToggleRight,
  LogOut,
  Monitor,
  Shield,
  Loader2,
  ArrowLeft,
  Eye,
  EyeOff,
  Pencil,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Create User Dialog ───────────────────────────────────────────────────────
function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    username: "", password: "", displayName: "", email: "",
    jellyfinUsername: "", jellyfinPassword: "", maxConcurrentDevices: "1",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showJfPwd, setShowJfPwd] = useState(false);
  const createUser = trpc.admin.createUser.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser.mutateAsync({
        username: form.username,
        password: form.password,
        displayName: form.displayName || undefined,
        email: form.email || undefined,
        jellyfinUsername: form.jellyfinUsername,
        jellyfinPassword: form.jellyfinPassword,
        maxConcurrentDevices: parseInt(form.maxConcurrentDevices) || 1,
      });
      toast.success(`User "${form.username}" created.`);
      setOpen(false);
      setForm({ username: "", password: "", displayName: "", email: "", jellyfinUsername: "", jellyfinPassword: "", maxConcurrentDevices: "1" });
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast.error(msg.includes("CONFLICT") ? "Username already exists." : msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 font-semibold" style={{ background: "linear-gradient(135deg, oklch(0.72 0.18 195), oklch(0.65 0.22 185))", color: "oklch(0.08 0.01 240)" }}>
          <Plus className="h-4 w-4" /> New User
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" style={{ background: "oklch(0.10 0.015 240)", border: "1px solid oklch(0.22 0.02 240)" }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold" style={{ fontFamily: "Rajdhani, sans-serif" }}>Create Subscriber Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username *" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} placeholder="voltix_user" />
            <Field label="Display Name" value={form.displayName} onChange={v => setForm(f => ({ ...f, displayName: v }))} placeholder="John Doe" />
          </div>
          <PasswordField label="Password *" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} show={showPwd} onToggle={() => setShowPwd(v => !v)} placeholder="Min. 6 characters" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="user@example.com" type="email" />
            <Field label="Max Devices" value={form.maxConcurrentDevices} onChange={v => setForm(f => ({ ...f, maxConcurrentDevices: v }))} placeholder="1" type="number" />
          </div>
          <div className="border-t border-border/50 pt-3">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" style={{ color: "oklch(0.72 0.18 195)" }} />
              Hidden Jellyfin credentials — users never see these
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jellyfin Username *" value={form.jellyfinUsername} onChange={v => setForm(f => ({ ...f, jellyfinUsername: v }))} placeholder="jf_user" />
              <PasswordField label="Jellyfin Password *" value={form.jellyfinPassword} onChange={v => setForm(f => ({ ...f, jellyfinPassword: v }))} show={showJfPwd} onToggle={() => setShowJfPwd(v => !v)} placeholder="••••••••" />
            </div>
          </div>
          <Button type="submit" disabled={createUser.isPending} className="w-full h-10 font-semibold" style={{ background: "linear-gradient(135deg, oklch(0.72 0.18 195), oklch(0.65 0.22 185))", color: "oklch(0.08 0.01 240)" }}>
            {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit User Dialog ─────────────────────────────────────────────────────────
interface EditableUser {
  id: number; username: string; displayName: string | null;
  email: string | null; isActive: boolean; maxConcurrentDevices: number;
}

function EditUserDialog({ user, onUpdated }: { user: EditableUser; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    newPassword: "",
    jellyfinUsername: "",
    jellyfinPassword: "",
    maxConcurrentDevices: String(user.maxConcurrentDevices),
    isActive: user.isActive,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showJfPwd, setShowJfPwd] = useState(false);
  const updateUser = trpc.admin.updateUser.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateUser.mutateAsync({
        userId: user.id,
        displayName: form.displayName || undefined,
        email: form.email || undefined,
        newPassword: form.newPassword || undefined,
        jellyfinUsername: form.jellyfinUsername || undefined,
        jellyfinPassword: form.jellyfinPassword || undefined,
        maxConcurrentDevices: parseInt(form.maxConcurrentDevices) || undefined,
        isActive: form.isActive,
      });
      toast.success(`User "${user.username}" updated.`);
      setOpen(false);
      onUpdated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" style={{ background: "oklch(0.10 0.015 240)", border: "1px solid oklch(0.22 0.02 240)" }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold" style={{ fontFamily: "Rajdhani, sans-serif" }}>
            Edit — @{user.username}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Display Name" value={form.displayName} onChange={v => setForm(f => ({ ...f, displayName: v }))} placeholder={user.username} />
            <Field label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="user@example.com" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PasswordField label="New Password" value={form.newPassword} onChange={v => setForm(f => ({ ...f, newPassword: v }))} show={showPwd} onToggle={() => setShowPwd(v => !v)} placeholder="Leave blank to keep" />
            <Field label="Max Devices" value={form.maxConcurrentDevices} onChange={v => setForm(f => ({ ...f, maxConcurrentDevices: v }))} placeholder="1" type="number" />
          </div>

          {/* Subscription toggle */}
          <div className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ background: "oklch(0.14 0.015 240)" }}>
            <span className="text-xs font-medium text-foreground/70 flex-1">Subscription Active</span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: form.isActive ? "oklch(0.72 0.22 145)" : "oklch(0.65 0.22 25)" }}
            >
              {form.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              {form.isActive ? "Active" : "Inactive"}
            </button>
          </div>

          <div className="border-t border-border/50 pt-3">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" style={{ color: "oklch(0.72 0.18 195)" }} />
              Update hidden Jellyfin credentials (leave blank to keep current)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jellyfin Username" value={form.jellyfinUsername} onChange={v => setForm(f => ({ ...f, jellyfinUsername: v }))} placeholder="Leave blank to keep" />
              <PasswordField label="Jellyfin Password" value={form.jellyfinPassword} onChange={v => setForm(f => ({ ...f, jellyfinPassword: v }))} show={showJfPwd} onToggle={() => setShowJfPwd(v => !v)} placeholder="Leave blank to keep" />
            </div>
          </div>
          <Button type="submit" disabled={updateUser.isPending} className="w-full h-10 font-semibold" style={{ background: "linear-gradient(135deg, oklch(0.72 0.18 195), oklch(0.65 0.22 185))", color: "oklch(0.08 0.01 240)" }}>
            {updateUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared form field components ─────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground/70">{label}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="bg-input border-border h-9 text-sm" />
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground/70">{label}</Label>
      <div className="relative">
        <Input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="bg-input border-border h-9 text-sm pr-8" />
        <button type="button" onClick={onToggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function Admin() {
  const { user: adminUser, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = trpc.admin.listUsers.useQuery();
  const { data: sessions, isLoading: sessionsLoading } = trpc.admin.allSessions.useQuery();

  const toggleActive = trpc.admin.toggleUserActive.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); utils.admin.allSessions.invalidate(); },
  });
  const forceLogout = trpc.admin.forceLogoutUser.useMutation({
    onSuccess: () => utils.admin.allSessions.invalidate(),
  });

  if (!isAuthenticated || adminUser?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Admin access required.</p>
          <Button variant="ghost" onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const handleToggle = async (userId: number, currentState: boolean) => {
    await toggleActive.mutateAsync({ userId, isActive: !currentState });
    toast.success(`User ${!currentState ? "activated" : "deactivated"}.`);
  };

  const handleForceLogout = async (userId: number, username: string) => {
    await forceLogout.mutateAsync({ userId });
    toast.success(`All sessions for "${username}" invalidated.`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 80% 10%, oklch(0.12 0.04 220) 0%, oklch(0.08 0.01 240) 50%, oklch(0.05 0.005 240) 100%)" }}>
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(oklch(0.72 0.18 195 / 0.03) 1px, transparent 1px), linear-gradient(90deg, oklch(0.72 0.18 195 / 0.03) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "Rajdhani, sans-serif", letterSpacing: "0.05em" }}>Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Voltix Studios Management</p>
            </div>
          </div>
          <img src="/manus-storage/voltix-logo_19225241.png" alt="Voltix" style={{ height: "36px", filter: "drop-shadow(0 0 8px oklch(0.72 0.18 195 / 0.4))" }} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Users", value: users?.length ?? 0, icon: <Users className="h-5 w-5" />, color: "oklch(0.72 0.18 195)" },
            { label: "Active Subscriptions", value: users?.filter(u => u.isActive).length ?? 0, icon: <Shield className="h-5 w-5" />, color: "oklch(0.72 0.22 145)" },
            { label: "Inactive", value: users?.filter(u => !u.isActive).length ?? 0, icon: <ToggleLeft className="h-5 w-5" />, color: "oklch(0.65 0.22 25)" },
            { label: "Active Sessions", value: sessions?.length ?? 0, icon: <Monitor className="h-5 w-5" />, color: "oklch(0.65 0.22 185)" },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl p-4" style={{ background: "oklch(0.10 0.015 240 / 0.9)", border: "1px solid oklch(0.22 0.02 240 / 0.6)" }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: stat.color }}>{stat.icon}<span className="text-xs font-medium text-muted-foreground">{stat.label}</span></div>
              <p className="text-2xl font-bold" style={{ fontFamily: "Rajdhani, sans-serif", color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users">
          <TabsList className="mb-6" style={{ background: "oklch(0.10 0.015 240)", border: "1px solid oklch(0.22 0.02 240)" }}>
            <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" />Users</TabsTrigger>
            <TabsTrigger value="sessions" className="gap-1.5"><Monitor className="h-4 w-4" />Sessions</TabsTrigger>
          </TabsList>

          {/* Users tab */}
          <TabsContent value="users">
            <div className="rounded-2xl overflow-hidden" style={{ background: "oklch(0.10 0.015 240 / 0.9)", border: "1px solid oklch(0.22 0.02 240 / 0.6)" }}>
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "Rajdhani, sans-serif" }}>Subscriber Accounts</h2>
                <CreateUserDialog onCreated={() => refetchUsers()} />
              </div>
              {usersLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "oklch(0.72 0.18 195)" }} /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-xs">User</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Email</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Devices</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Joined</TableHead>
                        <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map(u => (
                        <TableRow key={u.id} className="border-border/30 hover:bg-white/[0.02]">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, oklch(0.72 0.18 195), oklch(0.65 0.22 185))", color: "oklch(0.08 0.01 240)" }}>
                                {(u.displayName ?? u.username)[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{u.displayName ?? u.username}</p>
                                <p className="text-xs text-muted-foreground">@{u.username}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full" style={{ background: u.isActive ? "oklch(0.72 0.22 145 / 0.12)" : "oklch(0.65 0.22 25 / 0.12)", color: u.isActive ? "oklch(0.72 0.22 145)" : "oklch(0.65 0.22 25)" }}>
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: u.isActive ? "oklch(0.72 0.22 145)" : "oklch(0.65 0.22 25)" }} />
                              {u.isActive ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-foreground font-medium">{u.maxConcurrentDevices}</span>
                              <span className="text-xs text-muted-foreground">max</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 justify-end">
                              <EditUserDialog user={u} onUpdated={() => refetchUsers()} />
                              <Button variant="ghost" size="sm" onClick={() => handleToggle(u.id, u.isActive)} disabled={toggleActive.isPending} className="h-7 px-2 gap-1 text-xs" style={{ color: u.isActive ? "oklch(0.65 0.22 25)" : "oklch(0.72 0.22 145)" }}>
                                {u.isActive ? <><ToggleRight className="h-3.5 w-3.5" />Deactivate</> : <><ToggleLeft className="h-3.5 w-3.5" />Activate</>}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleForceLogout(u.id, u.username)} disabled={forceLogout.isPending} className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-red-400">
                                <LogOut className="h-3.5 w-3.5" />Kick
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {users?.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">No subscriber accounts yet.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Sessions tab */}
          <TabsContent value="sessions">
            <div className="rounded-2xl overflow-hidden" style={{ background: "oklch(0.10 0.015 240 / 0.9)", border: "1px solid oklch(0.22 0.02 240 / 0.6)" }}>
              <div className="p-5 border-b border-border/50">
                <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "Rajdhani, sans-serif" }}>Active Sessions</h2>
                <p className="text-xs text-muted-foreground mt-0.5">All authenticated sessions across all devices</p>
              </div>
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "oklch(0.72 0.18 195)" }} /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-xs">User ID</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Device</TableHead>
                        <TableHead className="text-muted-foreground text-xs">IP Address</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Jellyfin Token</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Token Refreshed</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Last Ping</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions?.map(s => (
                        <TableRow key={s.id} className="border-border/30 hover:bg-white/[0.02]">
                          <TableCell className="text-sm text-muted-foreground">#{s.voltixUserId}</TableCell>
                          <TableCell><p className="text-sm text-foreground">{s.deviceName ?? "Unknown"}</p></TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">{s.ipAddress ?? "—"}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: s.jellyfinReady ? "oklch(0.72 0.22 145 / 0.12)" : "oklch(0.65 0.22 25 / 0.12)", color: s.jellyfinReady ? "oklch(0.72 0.22 145)" : "oklch(0.65 0.22 25)" }}>
                              {s.jellyfinReady ? "Active" : "None"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <RefreshCw className="h-3 w-3" />
                              {timeAgo(s.tokenRefreshedAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.72 0.22 145)" }} />
                              <span className="text-xs text-muted-foreground">{timeAgo(s.lastPingAt)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {sessions?.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">No active sessions.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
