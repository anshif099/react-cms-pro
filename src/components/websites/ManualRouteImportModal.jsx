import React, { useState, useRef } from "react";
import { Plus, Trash2, HelpCircle, FileText, Upload, Settings } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import websiteSyncService from "../../services/websiteSyncService";

export function ManualRouteImportModal({ isOpen, onClose, onImport, loading }) {
  const [activeTab, setActiveTab] = useState("fields");
  
  // Tab 1: Fields list
  const [manualRoutes, setManualRoutes] = useState([
    { id: Math.random().toString(), path: "/", title: "Home" }
  ]);

  // Tab 2: CSV paste & upload
  const [csvText, setCsvText] = useState("");
  const fileInputRef = useRef(null);

  const handleAddRow = () => {
    setManualRoutes(prev => [
      ...prev,
      { id: Math.random().toString(), path: "", title: "" }
    ]);
  };

  const handleRemoveRow = (id) => {
    setManualRoutes(prev => prev.filter(r => r.id !== id));
  };

  const handleFieldChange = (id, field, value) => {
    setManualRoutes(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleImportFields = async (e) => {
    e.preventDefault();
    // Validate rows
    const validRoutes = manualRoutes.filter(r => r.path.trim() && r.title.trim());
    if (validRoutes.length === 0) return;

    try {
      await onImport(validRoutes);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportCSV = async (e) => {
    e.preventDefault();
    if (!csvText.trim()) return;

    try {
      const parsed = websiteSyncService.parseRouteCSV(csvText);
      if (parsed.length === 0) return;

      await onImport(parsed);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
    };
    reader.readAsText(file);
  };

  const tabBtnClass = (tab) => `
    text-xs font-bold px-4 py-2 border rounded-lg transition-all cursor-pointer
    ${activeTab === tab 
      ? "bg-slate-800 border-slate-700 text-white" 
      : "border-transparent text-slate-400 hover:text-slate-200"
    }
  `;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manual Route Import Wizard"
      size="lg"
    >
      <div className="space-y-4 text-left">
        <div className="flex bg-slate-950/40 p-1 border border-admin-border dark:border-slate-800 rounded-lg self-start">
          <button 
            type="button" 
            onClick={() => setActiveTab("fields")}
            className={tabBtnClass("fields")}
          >
            Type Routes Manually
          </button>
          <button 
            type="button" 
            onClick={() => setActiveTab("csv")}
            className={tabBtnClass("csv")}
          >
            Paste/Upload CSV
          </button>
        </div>

        {activeTab === "fields" ? (
          <form onSubmit={handleImportFields} className="space-y-4">
            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
              {manualRoutes.map((row, index) => (
                <div key={row.id} className="flex gap-3 items-end">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <Input
                      label={index === 0 ? "Path Slug" : ""}
                      placeholder="e.g. /about"
                      value={row.path}
                      onChange={(e) => handleFieldChange(row.id, "path", e.target.value)}
                      required
                    />
                    <Input
                      label={index === 0 ? "Page Title" : ""}
                      placeholder="e.g. About Us"
                      value={row.title}
                      onChange={(e) => handleFieldChange(row.id, "title", e.target.value)}
                      required
                    />
                  </div>
                  {manualRoutes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="p-2 border border-admin-border dark:border-slate-800 text-admin-secondary hover:text-admin-danger hover:bg-slate-850 rounded-lg transition-colors cursor-pointer mb-0.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                type="button"
                onClick={handleAddRow}
                variant="secondary"
                className="gap-1.5 border-slate-800 font-bold"
              >
                <Plus className="w-4 h-4" /> Add Route Row
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={onClose}
                  variant="secondary"
                  className="border-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                >
                  Import Routes
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleImportCSV} className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-admin-secondary uppercase tracking-wider">
                  Raw CSV Route List
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-bold"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload File (.csv/.txt)
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt"
                  className="hidden"
                />
              </div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="/, Home Page&#10;/about, About Us&#10;/contact, Contact"
                rows={6}
                className="w-full text-xs font-mono py-2.5 px-3 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-850 dark:border-slate-800 outline-none hover:border-slate-650 focus:border-primary focus:ring-2 focus:ring-primary/25 resize-y"
              />
              <div className="flex items-start gap-1.5 p-2 bg-slate-900/60 border border-slate-850 rounded text-[10px] text-admin-secondary leading-relaxed">
                <HelpCircle className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                <p>Provide lines in the format: <code>path, pageTitle</code> or <code>id, path, pageTitle</code>. Do not include headers. Auto-discovered routing ids are computed from slug paths.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                onClick={onClose}
                variant="secondary"
                className="border-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={!csvText.trim()}
              >
                Parse & Import
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

export default ManualRouteImportModal;
