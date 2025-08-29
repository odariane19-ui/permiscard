import { 
  type Fisher, type Permit, type Vessel, type Technique, 
  type Media, type Card, type User, type ScanLog, type Config,
  type InsertFisher, type InsertPermit, type InsertVessel, 
  type InsertTechnique, type InsertMedia, type InsertCard, 
  type InsertUser, type InsertConfig, type FullPermit, type CreatePermit 
} from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;

  createFisher(fisher: InsertFisher): Promise<Fisher>;
  getFisher(id: string): Promise<Fisher | undefined>;

  createPermit(permitData: CreatePermit): Promise<FullPermit>;
  getPermit(id: string): Promise<FullPermit | undefined>;
  getPermits(filters?: {
    zone?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<FullPermit[]>;
  updatePermit(id: string, permit: Partial<InsertPermit>): Promise<FullPermit | undefined>;
  deletePermit(id: string): Promise<boolean>;

  createCard(card: InsertCard): Promise<Card>;
  getCard(id: string): Promise<Card | undefined>;
  getCardByPermitId(permitId: string): Promise<Card | undefined>;

  createMedia(media: InsertMedia): Promise<Media>;
  getMediaByPermitId(permitId: string): Promise<Media[]>;

  createScanLog(log: Omit<ScanLog, 'id' | 'scanDate'>): Promise<ScanLog>;
  getScanLogs(cardId?: string): Promise<ScanLog[]>;

  // Config management
  getConfigs(): Promise<Config[]>;
  getConfigsByType(type: string): Promise<Config[]>;
  createConfig(config: InsertConfig): Promise<Config>;
  deleteConfig(id: string): Promise<boolean>;

  getStats(): Promise<{
    totalPermits: number;
    activePermits: number;
    expiredPermits: number;
    pendingSync: number;
  }>;
}

export class MemStorage implements IStorage {
  private fishers: Map<string, Fisher> = new Map();
  private permits: Map<string, Permit> = new Map();
  private vessels: Map<string, Vessel> = new Map();
  private techniques: Map<string, Technique> = new Map();
  private media: Map<string, Media> = new Map();
  private cards: Map<string, Card> = new Map();
  private users: Map<string, User> = new Map();
  private scanLogs: Map<string, ScanLog> = new Map();
  private configs: Map<string, Config> = new Map();

  constructor() {
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    // Create default users
    const adminId = randomUUID();
    const userId = randomUUID();
    
    this.users.set(adminId, {
      id: adminId,
      username: "admin",
      password: await bcrypt.hash("admin123", 10),
      role: "admin"
    });

    this.users.set(userId, {
      id: userId,
      username: "user",
      password: await bcrypt.hash("user123", 10),
      role: "user"
    });

    // Initialize default configs
    const defaultConfigs = [
      // Categories
      { type: 'categories', value: 'A', label: 'Catégorie A' },
      { type: 'categories', value: 'B', label: 'Catégorie B' },
      { type: 'categories', value: 'C', label: 'Catégorie C' },
      
      // Zones
      { type: 'zones', value: 'cotiere', label: 'Côtière' },
      { type: 'zones', value: 'lagunaire', label: 'Lagunaire' },
      { type: 'zones', value: 'haute-mer', label: 'Haute mer' },
      { type: 'zones', value: 'aheme', label: 'Ahémé' },
      
      // Types de pêche
      { type: 'types_peche', value: 'artisanale', label: 'Artisanale' },
      { type: 'types_peche', value: 'industrielle', label: 'Industrielle' },
      { type: 'types_peche', value: 'sportive', label: 'Sportive' },
      { type: 'types_peche', value: 'eau-profondes', label: 'Pêcheur en Eau Profondes' },
    ];

    defaultConfigs.forEach(config => {
      const id = randomUUID();
      this.configs.set(id, {
        ...config,
        id,
        active: true,
        createdAt: new Date()
      });
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const user: User = { 
      ...insertUser, 
      id,
      password: hashedPassword,
      role: insertUser.role || "user"
    };
    this.users.set(id, user);
    return user;
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values()).map(user => ({
      ...user,
      password: '[HIDDEN]'
    }));
  }

  async createFisher(insertFisher: InsertFisher): Promise<Fisher> {
    const id = randomUUID();
    const fisher: Fisher = { 
      ...insertFisher, 
      id,
      createdAt: new Date()
    };
    this.fishers.set(id, fisher);
    return fisher;
  }

  async getFisher(id: string): Promise<Fisher | undefined> {
    return this.fishers.get(id);
  }

  async createPermit(permitData: CreatePermit): Promise<FullPermit> {
    const fisherId = randomUUID();
    const permitId = randomUUID();

    const fisher: Fisher = {
      ...permitData.fisher,
      id: fisherId,
      createdAt: new Date()
    };
    this.fishers.set(fisherId, fisher);

    const permit: Permit = {
      ...permitData.permit,
      id: permitId,
      fisherId,
      horodateur: new Date(),
      syncStatus: "synced",
    };
    this.permits.set(permitId, permit);

    let vessel: Vessel | undefined;
    if (permitData.vessel) {
      const vesselId = randomUUID();
      vessel = {
        id: vesselId,
        permitId,
        nomEmbarcation: permitData.vessel.nomEmbarcation || null,
        numEmbarcation: permitData.vessel.numEmbarcation || null,
        siteDebarquement: permitData.vessel.siteDebarquement || null,
        siteHabitation: permitData.vessel.siteHabitation || null
      };
      this.vessels.set(vesselId, vessel);
    }

    let technique: Technique | undefined;
    if (permitData.technique) {
      const techniqueId = randomUUID();
      technique = {
        ...permitData.technique,
        id: techniqueId,
        permitId,
        typeEngin: permitData.technique.typeEngin || null,
        techniquePeche: permitData.technique.techniquePeche || null,
        especesCiblees: permitData.technique.especesCiblees || null
      };
      this.techniques.set(techniqueId, technique);
    }

    let media: Media[] = [];
    if (permitData.photo) {
      const mediaId = randomUUID();
      const photoMedia: Media = {
        id: mediaId,
        permitId,
        type: "photo_identite",
        url: `/api/media/${mediaId}`,
        base64Data: permitData.photo
      };
      this.media.set(mediaId, photoMedia);
      media = [photoMedia];
    }

    return {
      ...permit,
      fisher,
      vessel,
      technique,
      media
    };
  }

  async getPermit(id: string): Promise<FullPermit | undefined> {
    const permit = this.permits.get(id);
    if (!permit) return undefined;

    const fisher = this.fishers.get(permit.fisherId);
    if (!fisher) return undefined;

    const vessel = Array.from(this.vessels.values()).find(v => v.permitId === id);
    const technique = Array.from(this.techniques.values()).find(t => t.permitId === id);
    const media = Array.from(this.media.values()).filter(m => m.permitId === id);
    const card = Array.from(this.cards.values()).find(c => c.permitId === id);

    return {
      ...permit,
      fisher,
      vessel,
      technique,
      media,
      card
    };
  }

  async getPermits(filters?: {
    zone?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<FullPermit[]> {
    let permits = Array.from(this.permits.values());

    if (filters?.zone) {
      permits = permits.filter(p => p.zonePeche === filters.zone);
    }

    if (filters?.status) {
      const now = new Date();
      permits = permits.filter(p => {
        const expiration = new Date(p.dateExpiration);
        if (filters.status === "active") return expiration > now;
        if (filters.status === "expired") return expiration <= now;
        if (filters.status === "pending") return p.syncStatus === "pending";
        return true;
      });
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      permits = permits.filter(p => {
        const fisher = this.fishers.get(p.fisherId);
        return (
          fisher?.nom.toLowerCase().includes(searchLower) ||
          fisher?.prenoms.toLowerCase().includes(searchLower) ||
          fisher?.telephone.includes(searchLower) ||
          p.numSerie.toLowerCase().includes(searchLower)
        );
      });
    }

    const fullPermits: FullPermit[] = [];
    for (const permit of permits) {
      const fullPermit = await this.getPermit(permit.id);
      if (fullPermit) fullPermits.push(fullPermit);
    }

    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    return fullPermits.slice(offset, offset + limit);
  }

  async updatePermit(id: string, updates: Partial<InsertPermit>): Promise<FullPermit | undefined> {
    const permit = this.permits.get(id);
    if (!permit) return undefined;

    const updatedPermit = { ...permit, ...updates };
    this.permits.set(id, updatedPermit);

    return this.getPermit(id);
  }

  async deletePermit(id: string): Promise<boolean> {
    const permit = this.permits.get(id);
    if (!permit) return false;

    Array.from(this.vessels.values())
      .filter(v => v.permitId === id)
      .forEach(v => this.vessels.delete(v.id));

    Array.from(this.techniques.values())
      .filter(t => t.permitId === id)
      .forEach(t => this.techniques.delete(t.id));

    Array.from(this.media.values())
      .filter(m => m.permitId === id)
      .forEach(m => this.media.delete(m.id));

    Array.from(this.cards.values())
      .filter(c => c.permitId === id)
      .forEach(c => this.cards.delete(c.id));

    this.permits.delete(id);
    return true;
  }

  async createCard(insertCard: InsertCard): Promise<Card> {
    const id = randomUUID();
    const card: Card = {
      ...insertCard,
      id,
      createdAt: new Date(),
      version: insertCard.version || 1,
      pdfUrl: insertCard.pdfUrl || null
    };
    this.cards.set(id, card);
    return card;
  }

  async getCard(id: string): Promise<Card | undefined> {
    return this.cards.get(id);
  }

  async getCardByPermitId(permitId: string): Promise<Card | undefined> {
    return Array.from(this.cards.values()).find(c => c.permitId === permitId);
  }

  async createMedia(insertMedia: InsertMedia): Promise<Media> {
    const id = randomUUID();
    const media: Media = { 
      ...insertMedia, 
      id,
      base64Data: insertMedia.base64Data || null
    };
    this.media.set(id, media);
    return media;
  }

  async getMediaByPermitId(permitId: string): Promise<Media[]> {
    return Array.from(this.media.values()).filter(m => m.permitId === permitId);
  }

  async createScanLog(logData: Omit<ScanLog, 'id' | 'scanDate'>): Promise<ScanLog> {
    const id = randomUUID();
    const log: ScanLog = {
      ...logData,
      id,
      scanDate: new Date()
    };
    this.scanLogs.set(id, log);
    return log;
  }

  async getScanLogs(cardId?: string): Promise<ScanLog[]> {
    const logs = Array.from(this.scanLogs.values());
    return cardId ? logs.filter(l => l.cardId === cardId) : logs;
  }

  async getConfigs(): Promise<Config[]> {
    return Array.from(this.configs.values()).filter(c => c.active);
  }

  async getConfigsByType(type: string): Promise<Config[]> {
    return Array.from(this.configs.values()).filter(c => c.type === type && c.active);
  }

  async createConfig(insertConfig: InsertConfig): Promise<Config> {
    const id = randomUUID();
    const config: Config = {
      ...insertConfig,
      id,
      active: true,
      createdAt: new Date()
    };
    this.configs.set(id, config);
    return config;
  }

  async deleteConfig(id: string): Promise<boolean> {
    return this.configs.delete(id);
  }

  async getStats(): Promise<{
    totalPermits: number;
    activePermits: number;
    expiredPermits: number;
    pendingSync: number;
  }> {
    const permits = Array.from(this.permits.values());
    const now = new Date();

    const totalPermits = permits.length;
    const activePermits = permits.filter(p => new Date(p.dateExpiration) > now).length;
    const expiredPermits = permits.filter(p => new Date(p.dateExpiration) <= now).length;
    const pendingSync = permits.filter(p => p.syncStatus === "pending").length;

    return {
      totalPermits,
      activePermits,
      expiredPermits,
      pendingSync
    };
  }
}

export const storage = new MemStorage();