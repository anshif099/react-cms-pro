import React, { createContext, useState, useContext, useCallback, useMemo } from "react";
import mediaService from "../services/mediaService";
import useToast from "../hooks/useToast";

const MediaContext = createContext(null);

export function MediaProvider({ children }) {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState(["root"]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [mediaLoading, setMediaLoading] = useState(false);
  const toast = useToast();

  const fetchMedia = useCallback(async (websiteId) => {
    setMediaLoading(true);
    try {
      const list = await mediaService.getAll(websiteId);
      setFiles(list);
      
      // Extract unique folders from metadata
      const folderSet = new Set(["root"]);
      list.forEach(file => {
        if (file.folder) {
          folderSet.add(file.folder);
        }
      });
      setFolders(Array.from(folderSet));
      return list;
    } catch (error) {
      toast.error("Failed to load media assets.");
      console.error(error);
      return [];
    } finally {
      setMediaLoading(false);
    }
  }, [toast]);

  const addFolder = useCallback((folderName) => {
    const cleanFolder = folderName.trim();
    if (!cleanFolder) return;
    setFolders(prev => {
      if (prev.includes(cleanFolder)) return prev;
      return [...prev, cleanFolder];
    });
    toast.success(`Folder "${cleanFolder}" created.`);
  }, [toast]);

  const uploadFile = useCallback(async (websiteId, file, folder = "root") => {
    const fileKey = `${Date.now()}_${file.name}`;
    setUploadProgress(prev => ({ ...prev, [fileKey]: 0 }));
    
    try {
      const fileData = await mediaService.upload(websiteId, file, folder, (progress) => {
        setUploadProgress(prev => ({ ...prev, [fileKey]: progress }));
      });
      
      setFiles(prev => [fileData, ...prev]);
      setFolders(prev => {
        if (folder && !prev.includes(folder)) {
          return [...prev, folder];
        }
        return prev;
      });
      toast.success(`File "${file.name}" uploaded successfully.`);
      
      // Clear progress after success
      setTimeout(() => {
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[fileKey];
          return next;
        });
      }, 1000);
      
      return fileData;
    } catch (error) {
      toast.error(`Failed to upload "${file.name}".`);
      console.error(error);
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[fileKey];
        return next;
      });
      throw error;
    }
  }, [toast]);

  const deleteFile = useCallback(async (websiteId, fileId) => {
    setMediaLoading(true);
    try {
      await mediaService.delete(websiteId, fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success("File deleted successfully.");
    } catch (error) {
      toast.error("Failed to delete file.");
      console.error(error);
      throw error;
    } finally {
      setMediaLoading(false);
    }
  }, [toast]);

  const renameFile = useCallback(async (websiteId, fileId, newName) => {
    setMediaLoading(true);
    try {
      const updated = await mediaService.rename(websiteId, fileId, newName);
      setFiles(prev => prev.map(f => (f.id === fileId ? updated : f)));
      toast.success("File renamed successfully.");
      return updated;
    } catch (error) {
      toast.error("Failed to rename file.");
      console.error(error);
      throw error;
    } finally {
      setMediaLoading(false);
    }
  }, [toast]);

  const value = useMemo(() => ({
    files,
    folders,
    uploadProgress,
    mediaLoading,
    fetchMedia,
    addFolder,
    uploadFile,
    deleteFile,
    renameFile
  }), [
    files,
    folders,
    uploadProgress,
    mediaLoading,
    fetchMedia,
    addFolder,
    uploadFile,
    deleteFile,
    renameFile
  ]);

  return (
    <MediaContext.Provider value={value}>
      {children}
    </MediaContext.Provider>
  );
}

export function useMediaContext() {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error("useMediaContext must be used within a MediaProvider");
  }
  return context;
}
