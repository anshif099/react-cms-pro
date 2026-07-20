export interface NavItem {
  id: string;
  label: string;
  path?: string;
  url?: string;
  icon?: string;
  order: number;
  external?: boolean;
  children?: NavItem[];
}

export interface NavMenu {
  id: string;
  label: string;
  items: NavItem[];
  registeredAt?: number;
}
