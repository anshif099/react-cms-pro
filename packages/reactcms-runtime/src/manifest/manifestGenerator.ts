import { RouteEntry } from '@anshif.rainhopes/shared';

export function generateManifest(
  routes: RouteEntry[],
  sdkVersion: string,
  runtimeVersion: string
) {
  return {
    rcms: true,
    sdkVersion,
    runtimeVersion,
    routes: routes.map((r) => ({
      id: r.id,
      path: r.path,
      title: r.title,
    })),
  };
}
