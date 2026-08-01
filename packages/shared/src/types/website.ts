export type ConnectionHealth = 'healthy' | 'unverified' | 'error' | 'unknown';
export type SyncStatus = 'idle' | 'syncing' | 'manual' | 'error';
export type WebsiteStatus = 'connected' | 'importing' | 'pending' | 'disconnected' | 'error' | 'suspended';
export type ConnectionProvider = 'github' | 'cpanel' | 'sftp' | 'sdk';

export interface WebsiteSourceConnection {
  provider: ConnectionProvider;
  status: 'pending' | 'importing' | 'ready' | 'disconnected' | 'error';
  repository?: string;
  branch?: string;
  rootDirectory?: string;
  sourceRevision?: string;
  artifactPath?: string;
  endpoint?: string;
  port?: number;
  fileCount?: number;
  routeCount?: number;
  importedAt?: number;
  error?: string;
}

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
  status: WebsiteStatus;
  sdkInstalled: boolean;
  sourceConnected?: boolean;
  connectionProvider?: ConnectionProvider;
  connection?: WebsiteSourceConnection;
  sdkVersion?: string;
  lastSync?: number;
  connectionHealth: ConnectionHealth;
  syncStatus: SyncStatus;
  syncMode?: 'manifest' | 'manual' | 'runtime' | 'registry';
  createdAt: number;
  updatedAt: number;
}
