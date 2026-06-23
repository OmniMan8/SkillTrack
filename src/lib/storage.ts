import { AppData } from "../types";

const STORAGE_KEY = "skilltrack_data";

export const storage = {
  save: (data: AppData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  load: (): AppData => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { sets: [] };
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load data", e);
      return { sets: [] };
    }
  },

  exportJSON: (data: AppData) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skilltrack-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importJSON: (file: File): Promise<AppData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
};
