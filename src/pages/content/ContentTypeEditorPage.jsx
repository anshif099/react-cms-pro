import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Save, Layers, Info, Trash2, GripVertical } from "lucide-react";
import { useContentTypes } from "../../hooks/useContentTypes";
import { useWebsites } from "../../hooks/useWebsites";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import DraggableList from "../../components/ui/DraggableList";

const FIELD_TYPES = [
  { value: "text", label: "Single-line Text" },
  { value: "textarea", label: "Multi-line Text (Textarea)" },
  { value: "richtext", label: "Rich Text (Tiptap)" },
  { value: "image", label: "Image Asset Picker" },
  { value: "url", label: "URL Link" },
  { value: "number", label: "Numeric Input" },
  { value: "color", label: "Color Swatch Picker" },
  { value: "boolean", label: "Yes/No (Boolean)" }
];

export function ContentTypeEditorPage() {
  const { websiteId, typeId } = useParams();
  const navigate = useNavigate();

  const { selectWebsite, selectedWebsite } = useWebsites();
  const { createContentType, updateContentType, loadContentTypes, contentTypes, loading } = useContentTypes();

  const isEdit = !!typeId;
  const [saving, setSaving] = useState(false);

  // Schema form values
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [fields, setFields] = useState([]);

  useEffect(() => {
    if (websiteId) {
      selectWebsite(websiteId);
      loadContentTypes(websiteId);
    }
  }, [websiteId, selectWebsite, loadContentTypes]);

  // Sync edit mode values
  useEffect(() => {
    if (isEdit && contentTypes.length > 0) {
      const type = contentTypes.find(t => t.id === typeId);
      if (type) {
        setName(type.name || "");
        setSlug(type.slug || "");
        setFields(type.fields || []);
      }
    }
  }, [isEdit, typeId, contentTypes]);

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (!isEdit) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
    }
  };

  const handleAddField = () => {
    const newField = {
      id: Math.random().toString(36).substring(2, 9),
      key: `field_${fields.length + 1}`,
      label: `Field Label ${fields.length + 1}`,
      type: "text",
      localized: true,
      required: false
    };
    setFields(prev => [...prev, newField]);
  };

  const handleRemoveField = (fieldId) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
  };

  const handleFieldChange = (fieldId, propKey, value) => {
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, [propKey]: value } : f));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const payload = { name, slug, fields };
      if (isEdit) {
        await updateContentType(websiteId, typeId, payload);
      } else {
        await createContentType(websiteId, payload);
      }
      navigate(`/content/${websiteId}/content-types`);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!selectedWebsite) {
    return <div className="text-left text-slate-400 py-6">Loading Content Type Editor...</div>;
  }

  const generatedSchemaJSON = JSON.stringify({ name, slug, fieldsCount: fields.length, fields }, null, 2);

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto">
      {/* Back Link */}
      <div>
        <button
          onClick={() => navigate(`/content/${websiteId}/content-types`)}
          className="flex items-center gap-1.5 text-xs font-semibold text-admin-secondary hover:text-primary transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to list
        </button>
      </div>

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 px-4 rounded-xl border border-admin-border dark:border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-lg sticky top-0 z-20">
        <div>
          <h2 className="text-xl font-bold text-admin-text tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <span>{isEdit ? "Modify Content Type Schema" : "Design Reusable Content Type"}</span>
          </h2>
          <span className="text-[10px] text-admin-secondary font-bold uppercase tracking-wider block mt-0.5">
            Website ID: {websiteId}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            variant="primary"
            className="gap-1.5 py-1.5 text-xs font-bold"
            loading={saving}
            disabled={!name.trim()}
          >
            <Save className="w-3.5 h-3.5" />
            {isEdit ? "Save Schema" : "Create Type"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Properties and Fields builder */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <Card title="Properties">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Content Type Name"
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. Staff Profile"
                required
                disabled={isEdit}
              />
              <Input
                label="Technical Slug Key"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}
                placeholder="e.g. staff-profile"
                required
                disabled={isEdit}
              />
            </div>
          </Card>

          {/* Fields Builder */}
          <Card 
            title="Custom Fields Schema" 
            subtitle="Declare individual data fields for this content type structure"
          >
            <div className="space-y-4">
              {fields.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950/10 text-xs text-admin-secondary">
                  No fields declared. Click below to add your first data field.
                </div>
              ) : (
                <DraggableList
                  items={fields}
                  onReorder={(list) => setFields(list)}
                  renderItem={(field, index) => (
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-admin-border dark:border-slate-800 bg-slate-900/30 group">
                      {/* Reorder drag handle */}
                      <div className="pt-2.5 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0">
                        <GripVertical className="w-4 h-4" />
                      </div>

                      {/* Config Fields Grid */}
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                        <Input
                          label="Field Label"
                          value={field.label}
                          onChange={(e) => handleFieldChange(field.id, "label", e.target.value)}
                          className="text-xs"
                          required
                        />
                        <Input
                          label="API Name Key"
                          value={field.key}
                          onChange={(e) => handleFieldChange(field.id, "key", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                          className="text-xs"
                          required
                        />
                        
                        <div className="space-y-1 text-left flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-admin-secondary uppercase tracking-wider block">
                            Field Format Type
                          </label>
                          <select
                            value={field.type}
                            onChange={(e) => handleFieldChange(field.id, "type", e.target.value)}
                            className="w-full text-xs py-2 px-2.5 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none hover:border-slate-450 focus:border-primary"
                          >
                            {FIELD_TYPES.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Toggles */}
                        <div className="sm:col-span-3 flex flex-wrap gap-4 pt-1 items-center select-none text-[11px] text-admin-secondary font-semibold">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!field.localized}
                              onChange={(e) => handleFieldChange(field.id, "localized", e.target.checked)}
                              className="rounded text-primary focus:ring-primary focus:ring-offset-0 border-slate-800 bg-slate-950 cursor-pointer"
                            />
                            <span>Enable Localization (i18n translations)</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!field.required}
                              onChange={(e) => handleFieldChange(field.id, "required", e.target.checked)}
                              className="rounded text-primary focus:ring-primary focus:ring-offset-0 border-slate-800 bg-slate-950 cursor-pointer"
                            />
                            <span>Make Field Required</span>
                          </label>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveField(field.id)}
                        className="p-2 text-admin-secondary hover:text-admin-danger hover:bg-slate-900 border border-slate-850 rounded-lg transition-colors cursor-pointer mt-1"
                        title="Delete Field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                />
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={handleAddField} variant="secondary" className="gap-1.5 border-slate-800 font-bold hover:bg-slate-900/40">
                  <Plus className="w-4.5 h-4.5" />
                  Add Custom Field
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Real-time JSON preview output */}
        <div className="space-y-6">
          <Card title="JSON Schema Payload" subtitle="Real-time compiler display">
            <div className="space-y-3.5">
              <pre className="w-full text-xs font-mono py-3 px-4 rounded-xl border border-admin-border bg-slate-950/40 text-slate-350 dark:border-slate-800 overflow-x-auto whitespace-pre max-h-[400px]">
                {generatedSchemaJSON}
              </pre>
              <div className="flex items-start gap-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-[10px] text-admin-secondary leading-relaxed">
                <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p>This JSON representation is saved to <code>contentTypes/{websiteId}/</code>. Connected SDK apps load this definition to reconstruct components dynamically.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default ContentTypeEditorPage;
