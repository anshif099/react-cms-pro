import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Menu, Link as LinkIcon, Compass, RefreshCw } from "lucide-react";
import { registryService } from "../../services/registryService";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../hooks/useToast";

export function NavigationPage() {
  const { websiteId } = useParams();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState({});

  const fetchNavigation = async () => {
    setLoading(true);
    try {
      const data = await registryService.getNavigation(websiteId);
      setMenus(data || {});
    } catch (error) {
      toast.error("Failed to load navigation menus");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (websiteId) {
      fetchNavigation();
    }
  }, [websiteId]);

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-admin-primary">Navigation Menus</h1>
          <p className="text-sm text-admin-secondary">
            Discovered navigation menus registered from your website runtime.
          </p>
        </div>
        <button
          onClick={fetchNavigation}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-admin-secondary hover:text-primary transition-colors cursor-pointer border rounded-md"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-admin-secondary">Loading navigation data...</div>
      ) : Object.keys(menus).length === 0 ? (
        <Card className="p-8 text-center">
          <Compass className="w-12 h-12 mx-auto text-admin-secondary mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-admin-primary">No Navigation Menus Discovered</h3>
          <p className="text-sm text-admin-secondary mt-1">
            Ensure the website runtime is running and declaring navigation menus using the <code>&lt;CMSNavigation&gt;</code> component.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {Object.entries(menus).map(([menuId, menu]) => (
            <Card key={menuId} className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Menu className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-admin-primary">{menu.label || menu.id}</span>
                </div>
                <Badge variant="outline">{menu.items?.length || 0} items</Badge>
              </div>

              <div className="space-y-2">
                {menu.items && menu.items.length > 0 ? (
                  menu.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex items-center justify-between p-2.5 bg-admin-card-bg border rounded-md hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {item.icon ? (
                          <span className="text-sm text-admin-secondary">{item.icon}</span>
                        ) : (
                          <LinkIcon className="w-3.5 h-3.5 text-admin-secondary" />
                        )}
                        <span className="text-sm font-medium text-admin-primary">{item.label}</span>
                      </div>
                      <span className="text-xs font-mono text-admin-secondary">
                        {item.path || item.url || "/"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-admin-secondary italic">This menu contains no links.</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default NavigationPage;
