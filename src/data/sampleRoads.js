// Constants for road types, statuses, materials, etc.
// Road data is now served from the SQLite database via API.

export const ROAD_TYPES = ["NH", "SH", "MDR", "ODR", "Village", "Concrete", "Earthen", ""];
export const SURFACE_MATERIALS = ["Asphalt", "Concrete", "Gravel", "Earthen", "WBM", "Rigid", ""];
export const DRAINAGE_TYPES = ["Open", "Closed", "None", "Under", ""];
export const ROAD_STATUSES = ["Good", "Fair", "Poor", "Under Construction"];
export const ZONES = [
  "Zone 1", "Zone 2", "Zone 3", "Zone 4",
];
export const WARDS = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
  "31", "32", "33", "34", "35", "36", "37", "38", "39", "40",
  "41", "42", "43", "44", "45", "46", "47", "48", "49", "50",
  "51", "52", "53", "54", "55", "56", "57", "58", "59", "60",
  "61", "62", "63", "64", "65", "66", "67", "68", "69", "70",
  "71", "72", "73", "74", "75", "76", "77", "78",
];

// Normalization map for fixing known misspellings in imported/legacy data
export const ROAD_TYPE_NORMALIZE = {
  concreat: "Concrete",
  concrete: "Concrete",
  earthen: "Earthen",
  odr: "ODR",
  nh: "NH",
  sh: "SH",
  mdr: "MDR",
  village: "Village",
};

export const DRAINAGE_NORMALIZE = {
  under: "Under",
  open: "Open",
  closed: "Closed",
  none: "None",
};

export const SURFACE_NORMALIZE = {
  rigid: "Rigid",
  asphalt: "Asphalt",
  concrete: "Concrete",
  gravel: "Gravel",
  earthen: "Earthen",
  wbm: "WBM",
};

// Color mapping for road types
export const ROAD_TYPE_COLORS = {
  NH: "#ef4444",
  SH: "#f59e0b",
  MDR: "#3b82f6",
  ODR: "#10b981",
  Village: "#8b5cf6",
  Concrete: "#06b6d4",
  Earthen: "#a78bfa",
  "": "#94a3b8",
};

export const STATUS_COLORS = {
  Good: "#10b981",
  Fair: "#f59e0b",
  Poor: "#ef4444",
  "Under Construction": "#6366f1",
};
