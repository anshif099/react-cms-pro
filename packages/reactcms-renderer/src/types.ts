import type { CSSProperties, ReactNode } from 'react';

export type ResponsiveMode = 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'custom';
export type RendererMode = 'edit' | 'preview' | 'runtime';
export type DropPosition = 'before' | 'inside' | 'after';

export interface ResponsiveStyles {
  base?: CSSProperties;
  desktop?: CSSProperties;
  laptop?: CSSProperties;
  tablet?: CSSProperties;
  mobile?: CSSProperties;
}

export interface ComponentNode {
  id: string;
  type: string;
  label?: string;
  props?: Record<string, any>;
  styles?: ResponsiveStyles;
  children?: ComponentNode[];
  hidden?: boolean;
  locked?: boolean;
  metadata?: {
    regionId?: string;
    global?: boolean;
    reusable?: boolean;
    symbolId?: string;
    accessibility?: Record<string, any>;
    seo?: Record<string, any>;
    bindings?: Record<string, any>;
    animation?: Record<string, any>;
    [key: string]: any;
  };
}

export interface PageComponentTree {
  id: string;
  type: 'page';
  version: 2;
  title?: string;
  locale?: string;
  children: ComponentNode[];
  styles?: ResponsiveStyles;
  metadata?: Record<string, any>;
}

export interface RendererMutation {
  nodeId: string;
  path: Array<string | number>;
  value: unknown;
}

export interface RendererComponentProps {
  node: ComponentNode;
  locale: string;
  responsiveMode: ResponsiveMode;
  mode: RendererMode;
  children?: ReactNode;
  mutate: (path: Array<string | number>, value: unknown) => void;
}

export type RegisteredRendererComponent = (props: RendererComponentProps) => ReactNode;

export interface RuntimeRendererProps {
  tree: PageComponentTree;
  locale?: string;
  responsiveMode?: ResponsiveMode;
  mode?: RendererMode;
  theme?: {
    colors?: Record<string, string>;
    typography?: Record<string, string>;
    buttons?: Record<string, string>;
    branding?: Record<string, string>;
    [key: string]: any;
  } | null;
  selectedIds?: string[];
  hoveredId?: string | null;
  registry?: ComponentRegistry;
  onSelect?: (nodeId: string, additive?: boolean) => void;
  onHover?: (nodeId: string | null) => void;
  onMutation?: (mutation: RendererMutation) => void;
  onMove?: (nodeId: string, targetId: string, position: DropPosition) => void;
  onInsert?: (componentType: string, targetId: string, position: DropPosition) => void;
  onCommand?: (command: string, nodeId: string) => void;
}

export interface ComponentRegistry {
  register(type: string, component: RegisteredRendererComponent): void;
  unregister(type: string): void;
  get(type: string): RegisteredRendererComponent | undefined;
  has(type: string): boolean;
  entries(): Array<[string, RegisteredRendererComponent]>;
}
