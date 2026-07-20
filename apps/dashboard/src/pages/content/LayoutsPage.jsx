import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Layout, Columns, RefreshCw } from "lucide-react";
import { registryService } from "../../services/registryService";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../hooks/useToast";

export function LayoutsPage() {
  const { websiteId } = useParams();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState({});

  const fetchLayouts = async () => {
    setLoading(true);
    try {
      const data = await registryService.getLayouts(websiteId);
      setLayouts(data || {});
    } catch (error) {
      toast.error("Failed to load layouts");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (layoutId) => {
    try {
      await registryService.setDefaultLayout(websiteId, layoutId);
      toast.success("Default layout updated successfully");
      await fetchLayouts();
    } catch (error) {
      toast.error("Failed to update default layout");
    }
  };

  useEffect(() => {
    if (websiteId) {
      fetchLayouts();
    }
  }, [websiteId]);

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-admin-primary">Layouts Registry</h1>
          <p className="text-sm text-admin-secondary">
            Discovered layouts registered explicitly from your website runtime.
          </p>
        </div>
        <button
          onClick={fetchLayouts}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-admin-secondary hover:text-primary transition-colors cursor-pointer border rounded-md"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-admin-secondary">Loading layout definitions...</div>
      ) : Object.keys(layouts).length === 0 ? (
        <Card className="p-8 text-center">
          <Layout className="w-12 h-12 mx-auto text-admin-secondary mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-admin-primary">No Layouts Discovered</h3>
          <p className="text-sm text-admin-secondary mt-1">
            Ensure the website runtime is running and declaring layouts using the <code>&lt;CMSLayout&gt;</code> component.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {Object.entries(layouts).map(([layoutId, layout]) => (
            <Card key={layoutId} className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Columns className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-admin-primary">{layout.label || layout.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  {layout.isDefault ? (
                    <Badge variant="success">Default</Badge>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(layoutId)}
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      Make Default
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-xs font-semibold text-admin-secondary block mb-1">Slots</span>
                  <div className="flex flex-wrap gap-1.5">
                    {layout.slots && layout.slots.length > 0 ? (
                      layout.slots.map((slot) => (
                        <Badge key={slot} variant="secondary">
                          {slot}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-admin-secondary italic">No slots defined</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-admin-secondary pt-2">
                  <span>Layout ID: <code>{layoutId}</code></span>
                  {layout.registeredAt && (
                    <span>Registered: {new Date(layout.registeredAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default LayoutsPage;
