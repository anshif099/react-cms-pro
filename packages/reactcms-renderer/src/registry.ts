import type {
  ComponentRegistry,
  RegisteredRendererComponent,
} from './types';

export class RuntimeComponentRegistry implements ComponentRegistry {
  private components = new Map<string, RegisteredRendererComponent>();

  register(type: string, component: RegisteredRendererComponent) {
    this.components.set(type, component);
  }

  unregister(type: string) {
    this.components.delete(type);
  }

  get(type: string) {
    return this.components.get(type);
  }

  has(type: string) {
    return this.components.has(type);
  }

  entries() {
    return Array.from(this.components.entries());
  }
}

export const defaultComponentRegistry = new RuntimeComponentRegistry();
