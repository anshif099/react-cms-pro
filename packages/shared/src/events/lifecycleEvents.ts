export interface HeartbeatPayload {
  timestamp: number;
  status: 'online' | 'offline' | 'degraded';
}

export interface PublishPagePayload {
  slug: string;
}
