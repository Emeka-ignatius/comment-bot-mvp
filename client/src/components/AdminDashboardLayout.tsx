import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Menu, X, LogOut, Settings } from 'lucide-react';
import { Link } from 'wouter';

interface AdminDashboardLayoutProps {
  children: React.ReactNode;
}

export default function AdminDashboardLayout({ children }: AdminDashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const navigationItems = [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'AI Auto-Comment', href: '/ai-comment', icon: '🤖' },
    { label: 'Accounts', href: '/accounts', icon: '🔐' },
    { label: 'Login An Account', href: '/login-account', icon: '🚀' },
    { label: 'Videos', href: '/videos', icon: '🎬' },
    { label: 'Comments', href: '/comments', icon: '💬' },
    { label: 'Jobs', href: '/jobs', icon: '⚙️' },
    { label: 'Batch Create', href: '/batch', icon: '📦' },
    { label: 'Logs', href: '/logs', icon: '📝' },
  ];

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-card border-r border-border transition-all duration-300 flex flex-col`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          {sidebarOpen && <h1 className="text-lg font-bold text-foreground">Comment Bot</h1>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-accent rounded"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigationItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a className="flex items-center gap-3 px-4 py-2 rounded hover:bg-accent text-foreground hover:text-accent-foreground transition-colors">
                <span className="text-xl">{item.icon}</span>
                {sidebarOpen && <span className="text-sm">{item.label}</span>}
              </a>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-2 rounded hover:bg-accent text-foreground hover:text-accent-foreground transition-colors">
            <Settings size={20} />
            {sidebarOpen && <span className="text-sm">Settings</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded hover:bg-destructive text-foreground hover:text-destructive-foreground transition-colors"
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Admin Dashboard</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.name || user?.email}</span>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
