import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { FullPermit } from '@shared/schema';

interface AdminStats {
  totalPermits: number;
  activePermits: number;
  expiredPermits: number;
  pendingSync: number;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentView, setCurrentView] = useState<'dashboard' | 'exports'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedPermits, setSelectedPermits] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const permitsPerPage = 10;

  // Fetch admin statistics
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ['/api/stats'],
    refetchInterval: 30000,
  });

  // Fetch permits with filters
  const { data: permits = [], isLoading: permitsLoading, refetch } = useQuery<FullPermit[]>({
    queryKey: ['/api/permits', { search: searchQuery, zone: filterZone, status: filterStatus, limit: permitsPerPage * 5, offset: 0 }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filterZone) params.set('zone', filterZone);
      if (filterStatus) params.set('status', filterStatus);
      params.set('limit', (permitsPerPage * 5).toString());
      params.set('offset', '0');

      const response = await fetch(`/api/permits?${params}`);
      if (!response.ok) throw new Error('Failed to fetch permits');
      return response.json();
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      // Trigger sync by refetching data
      await queryClient.invalidateQueries({ queryKey: ['/api'] });
    },
    onSuccess: () => {
      toast({
        title: 'Synchronisation réussie',
        description: 'Les données ont été synchronisées',
      });
    },
    onError: () => {
      toast({
        title: 'Erreur de synchronisation',
        description: 'Impossible de synchroniser les données',
        variant: 'destructive',
      });
    },
  });

  // Export mutations
  const exportMutation = useMutation({
    mutationFn: async (type: 'csv' | 'pdf-individual' | 'pdf-batch') => {
      if (type === 'csv') {
        const response = await fetch('/api/export/csv');
        if (!response.ok) throw new Error('Export failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'permits-export.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      } else if (type === 'pdf-batch' && selectedPermits.length > 0) {
        const response = await fetch('/api/cards/batch-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permitIds: selectedPermits }),
        });
        
        if (!response.ok) throw new Error('Batch export failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'permits-batch.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Export réussi',
        description: 'Le fichier a été téléchargé',
      });
    },
    onError: () => {
      toast({
        title: 'Erreur d\'export',
        description: 'Impossible de générer le fichier',
        variant: 'destructive',
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPermits(permits.map(p => p.id));
    } else {
      setSelectedPermits([]);
    }
  };

  const handleSelectPermit = (permitId: string, checked: boolean) => {
    if (checked) {
      setSelectedPermits([...selectedPermits, permitId]);
    } else {
      setSelectedPermits(selectedPermits.filter(id => id !== permitId));
    }
  };

  const handleDownloadPDF = (permitId: string) => {
    window.open(`/api/cards/${permitId}/pdf`, '_blank');
  };

  const filteredPermits = permits.slice((currentPage - 1) * permitsPerPage, currentPage * permitsPerPage);
  const totalPages = Math.ceil(permits.length / permitsPerPage);

  if (currentView === 'exports') {
    return (
      <div className="container mx-auto p-6 space-y-6 pb-20">
        <div className="flex items-center space-x-3 mb-6">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            data-testid="button-back-to-admin"
          >
            <i className="fas fa-arrow-left text-primary"></i>
          </button>
          <h2 className="text-xl font-bold">Exports</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PDF Exports */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <i className="fas fa-file-pdf text-red-500 mr-2"></i>
                Exports PDF
              </h3>
              <div className="space-y-4">
                <Button
                  onClick={() => exportMutation.mutate('pdf-batch')}
                  disabled={selectedPermits.length === 0 || exportMutation.isPending}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                  data-testid="button-export-pdf-batch"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="text-left">
                      <h4 className="font-medium">Cartes par lot</h4>
                      <p className="text-sm opacity-80">
                        {selectedPermits.length} cartes sélectionnées
                      </p>
                    </div>
                    <i className="fas fa-download"></i>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data Exports */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <i className="fas fa-table text-green-500 mr-2"></i>
                Exports Données
              </h3>
              <div className="space-y-4">
                <Button
                  onClick={() => exportMutation.mutate('csv')}
                  disabled={exportMutation.isPending}
                  className="w-full bg-green-50 hover:bg-green-100 text-green-700 border border-green-200"
                  data-testid="button-export-csv"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="text-left">
                      <h4 className="font-medium">Format CSV</h4>
                      <p className="text-sm opacity-80">Compatible Excel/Google Sheets</p>
                    </div>
                    <i className="fas fa-download"></i>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 pb-20">
      {/* Admin Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <button
              onClick={() => setLocation('/')}
              className="p-2 rounded-lg hover:bg-muted transition-colors md:hidden"
              data-testid="button-back-to-agent"
            >
              <i className="fas fa-arrow-left text-primary"></i>
            </button>
            <h1 className="text-2xl font-bold">Administration</h1>
          </div>
          <p className="text-muted-foreground">Gestion des permis de pêche</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            variant="outline"
            data-testid="button-admin-sync"
          >
            <i className={`fas fa-sync mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`}></i>
            Synchroniser
          </Button>
          <Button
            onClick={() => setLocation('/admin/config')}
            variant="outline"
            data-testid="button-admin-config"
          >
            <i className="fas fa-cog mr-2"></i>
            Configuration
          </Button>
          <Button
            onClick={() => setCurrentView('exports')}
            data-testid="button-show-exports"
          >
            <i className="fas fa-download mr-2"></i>
            Exports
          </Button>
        </div>
      </div>

      {/* Admin Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Permis</p>
                <p className="text-2xl font-bold" data-testid="admin-stats-total">
                  {statsLoading ? '...' : stats?.totalPermits ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-file-alt text-primary"></i>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Actifs</p>
                <p className="text-2xl font-bold text-secondary" data-testid="admin-stats-active">
                  {statsLoading ? '...' : stats?.activePermits ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-check-circle text-secondary"></i>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expirés</p>
                <p className="text-2xl font-bold text-destructive" data-testid="admin-stats-expired">
                  {statsLoading ? '...' : stats?.expiredPermits ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-destructive"></i>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Attente</p>
                <p className="text-2xl font-bold text-accent" data-testid="admin-stats-pending">
                  {statsLoading ? '...' : stats?.pendingSync ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-clock text-accent"></i>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"></i>
                <Input
                  type="text"
                  placeholder="Rechercher par nom, numéro, téléphone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-admin-search"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Select value={filterZone} onValueChange={setFilterZone}>
                <SelectTrigger className="w-40" data-testid="select-filter-zone">
                  <SelectValue placeholder="Toutes les zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Toutes les zones</SelectItem>
                  <SelectItem value="cotiere">Côtière</SelectItem>
                  <SelectItem value="lagunaire">Lagunaire</SelectItem>
                  <SelectItem value="haute-mer">Haute mer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40" data-testid="select-filter-status">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="expired">Expiré</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => refetch()}
                variant="outline"
                data-testid="button-refresh-permits"
              >
                <i className="fas fa-refresh"></i>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permits Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium">
                  <Checkbox
                    checked={selectedPermits.length === permits.length && permits.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                </th>
                <th className="text-left p-4 font-medium">Pêcheur</th>
                <th className="text-left p-4 font-medium">N° Série</th>
                <th className="text-left p-4 font-medium">Zone</th>
                <th className="text-left p-4 font-medium">Type</th>
                <th className="text-left p-4 font-medium">Expiration</th>
                <th className="text-left p-4 font-medium">Statut</th>
                <th className="text-left p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {permitsLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Chargement des permis...
                  </td>
                </tr>
              ) : filteredPermits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Aucun permis trouvé
                  </td>
                </tr>
              ) : (
                filteredPermits.map((permit) => {
                  const isExpired = new Date(permit.dateExpiration) <= new Date();
                  return (
                    <tr key={permit.id} className="hover:bg-muted/50 transition-colors" data-testid={`permit-row-${permit.id}`}>
                      <td className="p-4">
                        <Checkbox
                          checked={selectedPermits.includes(permit.id)}
                          onCheckedChange={(checked) => handleSelectPermit(permit.id, checked as boolean)}
                          data-testid={`checkbox-permit-${permit.id}`}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                            <i className="fas fa-user text-muted-foreground text-xs"></i>
                          </div>
                          <div>
                            <p className="font-medium">
                              {permit.fisher.nom} {permit.fisher.prenoms}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {permit.fisher.telephone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-sm">{permit.numSerie}</span>
                      </td>
                      <td className="p-4">{permit.zonePeche}</td>
                      <td className="p-4">{permit.typePeche}</td>
                      <td className="p-4">
                        {new Date(permit.dateExpiration).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                          isExpired
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-secondary/10 text-secondary'
                        }`}>
                          <i className={`fas ${isExpired ? 'fa-exclamation-triangle' : 'fa-check'} mr-1`}></i>
                          {isExpired ? 'Expiré' : 'Actif'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleDownloadPDF(permit.id)}
                            className="p-1 text-secondary hover:bg-secondary/10 rounded transition-colors"
                            data-testid={`button-download-${permit.id}`}
                          >
                            <i className="fas fa-download"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {permits.length > permitsPerPage && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Affichage de {(currentPage - 1) * permitsPerPage + 1} à {Math.min(currentPage * permitsPerPage, permits.length)} sur {permits.length} résultats
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
                data-testid="button-prev-page"
              >
                Précédent
              </Button>
              <span className="text-sm px-3 py-1 bg-primary text-primary-foreground rounded">
                {currentPage}
              </span>
              <Button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
                data-testid="button-next-page"
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
