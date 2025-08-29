import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { offlineStorage } from '@/lib/offline-storage';

interface Stats {
  totalPermits: number;
  activePermits: number;
  expiredPermits: number;
  pendingSync: number;
}

export default function AgentDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'idle'>('idle');

  const { data: stats } = useQuery<Stats>({
    queryKey: ['/api/stats'],
    enabled: navigator.onLine,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: recentPermits } = useQuery({
    queryKey: ['/api/permits'],
    queryFn: async () => {
      const response = await fetch('/api/permits?limit=5&offset=0');
      if (!response.ok) throw new Error('Failed to fetch permits');
      return response.json();
    },
    enabled: navigator.onLine,
  });

  // Auto-sync when coming online
  useEffect(() => {
    const handleOnline = async () => {
      if (syncStatus === 'idle') {
        setSyncStatus('syncing');
        try {
          const result = await offlineStorage.syncWithServer();
          if (result.success > 0) {
            toast({
              title: 'Synchronisation réussie',
              description: `${result.success} permis synchronisés`,
            });
          }
          if (result.failed > 0) {
            toast({
              title: 'Synchronisation partielle',
              description: `${result.failed} permis n'ont pas pu être synchronisés`,
              variant: 'destructive',
            });
          }
        } catch (error) {
          toast({
            title: 'Erreur de synchronisation',
            description: 'Impossible de synchroniser les données',
            variant: 'destructive',
          });
        } finally {
          setSyncStatus('idle');
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncStatus, toast]);

  const handleSync = async () => {
    if (!navigator.onLine) {
      toast({
        title: 'Hors ligne',
        description: 'Synchronisation impossible sans connexion internet',
        variant: 'destructive',
      });
      return;
    }

    setSyncStatus('syncing');
    try {
      const result = await offlineStorage.syncWithServer();
      toast({
        title: 'Synchronisation terminée',
        description: `${result.success} réussies, ${result.failed} échecs`,
      });
    } catch (error) {
      toast({
        title: 'Erreur de synchronisation',
        description: 'Impossible de synchroniser les données',
        variant: 'destructive',
      });
    } finally {
      setSyncStatus('idle');
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6 pb-20">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-file-alt text-primary"></i>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dossiers</p>
                <p className="text-xl font-bold" data-testid="stats-total-permits">
                  {stats?.totalPermits ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-sync text-secondary"></i>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-xl font-bold text-accent" data-testid="stats-pending-sync">
                  {stats?.pendingSync ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Actions rapides</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setLocation('/permit-form')}
              className="flex flex-col items-center p-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              data-testid="button-new-permit"
            >
              <i className="fas fa-plus text-2xl mb-2"></i>
              <span className="text-sm font-medium">Nouveau Permis</span>
            </button>
            <button
              onClick={() => setLocation('/scanner')}
              className="flex flex-col items-center p-4 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
              data-testid="button-scan-qr"
            >
              <i className="fas fa-qrcode text-2xl mb-2"></i>
              <span className="text-sm font-medium">Scanner QR</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Sync Action */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Synchronisation</h3>
              <p className="text-sm text-muted-foreground">
                {navigator.onLine ? 'En ligne' : 'Hors ligne'}
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={!navigator.onLine || syncStatus === 'syncing'}
              className="bg-muted text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
              data-testid="button-sync"
            >
              <i className={`fas fa-sync mr-2 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}></i>
              {syncStatus === 'syncing' ? 'Synchronisation...' : 'Synchroniser'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Permits */}
      {recentPermits && recentPermits.length > 0 && (
        <Card>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-semibold">Permis récents</h3>
            <button
              onClick={() => setLocation('/admin')}
              className="text-primary text-sm hover:underline"
              data-testid="link-view-all-permits"
            >
              Voir tout
            </button>
          </div>
          <div className="divide-y divide-border">
            {recentPermits.slice(0, 3).map((permit: any) => {
              const isExpired = new Date(permit.dateExpiration) <= new Date();
              return (
                <div
                  key={permit.id}
                  className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  data-testid={`permit-card-${permit.id}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                      <i className="fas fa-user text-muted-foreground"></i>
                    </div>
                    <div>
                      <p className="font-medium">
                        {permit.fisher.nom} {permit.fisher.prenoms}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {permit.numSerie} • {permit.zonePeche}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                      isExpired 
                        ? 'bg-destructive/10 text-destructive' 
                        : 'bg-secondary/10 text-secondary'
                    }`}>
                      <i className={`fas ${isExpired ? 'fa-exclamation-triangle' : 'fa-check'} mr-1`}></i>
                      {isExpired ? 'Expiré' : 'Actif'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
