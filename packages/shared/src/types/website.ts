export type ConnectionHealth = 'healthy' | 'unverified' | 'error' | 'unknown';
export type SyncStatus = 'idle' | 'syncing' | 'manual' | 'error';

export interface Website {
  id: string;
  name: string;
  domain: string;
  framework: string;
  hosting?: string;
  ownerName?: string;
  ownerEmail?: string;
  apiKey: string;
  secretKeyHash: string;
  verificationCode?: string;
  verificationStatus: 'verified' | 'unverified';
  status: 'active' | 'pending' | 'suspended';
  sdkInstalled: boolean;
  sdkVersion?: string;
  lastSync?: number;
  connectionHealth: ConnectionHealth;
  syncStatus: SyncStatus;
  syncMode?: 'manifest' | 'manual' | 'runtime';
  createdAt: number;
  updatedAt: number;
}
