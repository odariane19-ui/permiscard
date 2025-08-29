import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";

import Login from "@/pages/login";
import AgentDashboard from "@/pages/agent-dashboard";
import PermitForm from "@/pages/permit-form";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminConfig from "@/pages/admin-config";
import CameraCapture from "@/pages/camera-capture";
import QRScanner from "@/pages/qr-scanner";
import BottomNav from "@/components/bottom-nav";

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const token = localStorage.getItem('authToken');
  const userRole = localStorage.getItem('userRole');

  if (!token) {
    return <Login />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <div className="p-4 text-center">Accès non autorisé</div>;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <ProtectedRoute>
          <AgentDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/permit-form">
        <ProtectedRoute>
          <PermitForm />
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/config">
        <ProtectedRoute requiredRole="admin">
          <AdminConfig />
        </ProtectedRoute>
      </Route>
      <Route path="/camera">
        <ProtectedRoute>
          <CameraCapture />
        </ProtectedRoute>
      </Route>
      <Route path="/scanner">
        <ProtectedRoute>
          <QRScanner />
        </ProtectedRoute>
      </Route>
      <Route>
        <ProtectedRoute>
          <AgentDashboard />
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <div className={`offline-indicator ${!isOnline ? 'show' : ''}`}>
            <i className="fas fa-wifi-slash mr-2"></i>
            Mode hors ligne - Les données seront synchronisées à la reconnexion
          </div>

          <nav className="bg-primary text-primary-foreground p-4 flex items-center justify-between sticky top-0 z-50 shadow-lg">
            <div className="flex items-center space-x-3">
              <i className="fas fa-fish text-xl" data-testid="nav-logo"></i>
              <h1 className="text-lg font-semibold">Permis de Pêche</h1>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 text-sm" data-testid="sync-status">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-secondary' : 'bg-accent'} ${isOnline ? 'sync-indicator' : ''}`}></div>
                <span className="hidden sm:inline">{isOnline ? 'Synchronisé' : 'Hors ligne'}</span>
              </div>
              {localStorage.getItem('authToken') && (
                <button
                  onClick={() => {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    window.location.reload();
                  }}
                  className="text-sm hover:underline"
                  data-testid="button-logout"
                >
                  Déconnexion
                </button>
              )}
            </div>
          </nav>

          <Router />
          {localStorage.getItem('authToken') && <BottomNav />}
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;