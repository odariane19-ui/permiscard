import { FullPermit, CreatePermit } from '@shared/schema';

interface OfflinePermit extends CreatePermit {
  id: string;
  timestamp: number;
  synced: boolean;
}

class OfflineStorage {
  private dbName = 'FishingPermitsDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create permits store
        if (!db.objectStoreNames.contains('permits')) {
          const permitStore = db.createObjectStore('permits', { keyPath: 'id' });
          permitStore.createIndex('synced', 'synced', { unique: false });
          permitStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create cards store for offline viewing
        if (!db.objectStoreNames.contains('cards')) {
          const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
          cardStore.createIndex('permitId', 'permitId', { unique: false });
        }

        // Create sync queue
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('action', 'action', { unique: false });
        }
      };
    });
  }

  async savePermit(permit: CreatePermit): Promise<string> {
    if (!this.db) await this.init();

    const id = crypto.randomUUID();
    const offlinePermit: OfflinePermit = {
      ...permit,
      id,
      timestamp: Date.now(),
      synced: false
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['permits'], 'readwrite');
      const store = transaction.objectStore('permits');
      const request = store.add(offlinePermit);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedPermits(): Promise<OfflinePermit[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['permits'], 'readonly');
      const store = transaction.objectStore('permits');
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(false));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markPermitSynced(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['permits'], 'readwrite');
      const store = transaction.objectStore('permits');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const permit = getRequest.result;
        if (permit) {
          permit.synced = true;
          const putRequest = store.put(permit);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(); // Permit not found, consider it synced
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async cachePermit(permit: FullPermit): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cards'], 'readwrite');
      const store = transaction.objectStore('cards');
      const request = store.put({
        id: permit.id,
        permitId: permit.id,
        data: permit,
        cachedAt: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedPermit(id: string): Promise<FullPermit | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cards'], 'readonly');
      const store = transaction.objectStore('cards');
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async syncWithServer(): Promise<{ success: number; failed: number }> {
    const unsyncedPermits = await this.getUnsyncedPermits();
    let success = 0;
    let failed = 0;

    for (const permit of unsyncedPermits) {
      try {
        // Create FormData for multipart upload
        const formData = new FormData();
        
        // Prepare permit data without the offline metadata
        const { id, timestamp, synced, photo, ...permitData } = permit;
        formData.append('permitData', JSON.stringify(permitData));

        // Add photo if exists
        if (photo) {
          const response = await fetch(photo);
          const blob = await response.blob();
          formData.append('photo', blob, 'identity.jpg');
        }

        const response = await fetch('/api/permits', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          await this.markPermitSynced(permit.id);
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error('Sync failed for permit:', permit.id, error);
        failed++;
      }
    }

    return { success, failed };
  }

  async clearCache(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['permits', 'cards', 'syncQueue'], 'readwrite');
      
      const clearPromises = [
        new Promise<void>((res, rej) => {
          const req = transaction.objectStore('permits').clear();
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        }),
        new Promise<void>((res, rej) => {
          const req = transaction.objectStore('cards').clear();
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        }),
        new Promise<void>((res, rej) => {
          const req = transaction.objectStore('syncQueue').clear();
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        })
      ];

      Promise.all(clearPromises)
        .then(() => resolve())
        .catch(reject);
    });
  }
}

export const offlineStorage = new OfflineStorage();
