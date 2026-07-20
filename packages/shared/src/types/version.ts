export interface PlatformVersions {
  sdk: string;
  runtime: string;
  dashboard: string;
}

export interface VersionCompatibility {
  compatible: boolean;
  level: 'ok' | 'warn' | 'breaking';
  warnings: string[];
}
