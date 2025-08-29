import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Config } from '@shared/schema';

export default function AdminConfig() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<'categories' | 'zones' | 'types' | 'users'>('categories');
  const [newItem, setNewItem] = useState({ value: '', label: '' });
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });

  // Fetch configs
  const { data: configs = [], refetch } = useQuery<Config[]>({
    queryKey: ['/api/configs'],
  });

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
  });

  // Add config mutation
  const addConfigMutation = useMutation({
    mutationFn: async (data: { type: string; value: string; label: string }) => {
      const response = await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to add config');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/configs'] });
      setNewItem({ value: '', label: '' });
      toast({ title: 'Configuration ajoutée' });
    },
  });

  // Add user mutation
  const addUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; role: string }) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to add user');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setNewUser({ username: '', password: '', role: 'user' });
      toast({ title: 'Utilisateur créé' });
    },
  });

  // Delete config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/configs/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete config');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/configs'] });
      toast({ title: 'Configuration supprimée' });
    },
  });

  const handleAddConfig = () => {
    if (newItem.value && newItem.label) {
      addConfigMutation.mutate({
        type: activeTab,
        value: newItem.value,
        label: newItem.label,
      });
    }
  };

  const handleAddUser = () => {
    if (newUser.username && newUser.password) {
      addUserMutation.mutate(newUser);
    }
  };

  const getConfigsByType = (type: string) => {
    return configs.filter(config => config.type === type);
  };

  return (
    <div className="container mx-auto p-6 space-y-6 pb-20">
      <div className="flex items-center space-x-3 mb-6">
        <button
          onClick={() => setLocation('/admin')}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          data-testid="button-back-to-admin"
        >
          <i className="fas fa-arrow-left text-primary"></i>
        </button>
        <h2 className="text-xl font-bold">Configuration</h2>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-border">
        {[
          { key: 'categories', label: 'Catégories', icon: 'fa-tags' },
          { key: 'zones', label: 'Zones', icon: 'fa-map' },
          { key: 'types', label: 'Types de Pêche', icon: 'fa-fish' },
          { key: 'users', label: 'Utilisateurs', icon: 'fa-users' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid={`tab-${tab.key}`}
          >
            <i className={`fas ${tab.icon} mr-2`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Config Management */}
      {activeTab !== 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add New Config */}
          <Card>
            <CardHeader>
              <CardTitle>Ajouter {activeTab}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="config-value">Valeur</Label>
                <Input
                  id="config-value"
                  value={newItem.value}
                  onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                  placeholder="Valeur technique (ex: cotiere)"
                  data-testid="input-config-value"
                />
              </div>
              <div>
                <Label htmlFor="config-label">Libellé</Label>
                <Input
                  id="config-label"
                  value={newItem.label}
                  onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                  placeholder="Libellé affiché (ex: Côtière)"
                  data-testid="input-config-label"
                />
              </div>
              <Button
                onClick={handleAddConfig}
                disabled={!newItem.value || !newItem.label || addConfigMutation.isPending}
                className="w-full"
                data-testid="button-add-config"
              >
                <i className="fas fa-plus mr-2"></i>
                Ajouter
              </Button>
            </CardContent>
          </Card>

          {/* Existing Configs */}
          <Card>
            <CardHeader>
              <CardTitle>Configurations existantes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {getConfigsByType(activeTab).map((config) => (
                  <div
                    key={config.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    data-testid={`config-item-${config.id}`}
                  >
                    <div>
                      <p className="font-medium">{config.label}</p>
                      <p className="text-sm text-muted-foreground">{config.value}</p>
                    </div>
                    <Button
                      onClick={() => deleteConfigMutation.mutate(config.id)}
                      variant="destructive"
                      size="sm"
                      data-testid={`button-delete-${config.id}`}
                    >
                      <i className="fas fa-trash"></i>
                    </Button>
                  </div>
                ))}
                {getConfigsByType(activeTab).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune configuration trouvée
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Management */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add New User */}
          <Card>
            <CardHeader>
              <CardTitle>Créer Utilisateur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="user-username">Nom d'utilisateur</Label>
                <Input
                  id="user-username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="Nom d'utilisateur"
                  data-testid="input-user-username"
                />
              </div>
              <div>
                <Label htmlFor="user-password">Mot de passe</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Mot de passe"
                  data-testid="input-user-password"
                />
              </div>
              <div>
                <Label htmlFor="user-role">Rôle</Label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Utilisateur</SelectItem>
                    <SelectItem value="admin">Administrateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAddUser}
                disabled={!newUser.username || !newUser.password || addUserMutation.isPending}
                className="w-full"
                data-testid="button-add-user"
              >
                <i className="fas fa-user-plus mr-2"></i>
                Créer Utilisateur
              </Button>
            </CardContent>
          </Card>

          {/* Existing Users */}
          <Card>
            <CardHeader>
              <CardTitle>Utilisateurs existants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {users.map((user: any) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    data-testid={`user-item-${user.id}`}
                  >
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-sm text-muted-foreground capitalize">{user.role}</p>
                    </div>
                    <div className={`px-2 py-1 text-xs rounded-full ${
                      user.role === 'admin' 
                        ? 'bg-primary/10 text-primary' 
                        : 'bg-secondary/10 text-secondary'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : 'Utilisateur'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}