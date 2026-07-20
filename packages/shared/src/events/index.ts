export interface RCMSMessage<T = unknown> {
  rcms: true;
  version: 'v1';
  type: string;
  websiteId: string;
  payload: T;
  timestamp: number;
}
