/**
 * Utility functions for parsing and formatting database dates.
 * Handles normalizing SQLite UTC datestamps (e.g. YYYY-MM-DD HH:MM:SS) 
 * so JavaScript correctly translates them into the local timezone (e.g., IST).
 */

export function parseDbDate(ts) {
  if (!ts) return null;
  if (typeof ts === 'number') return new Date(ts);
  
  let cleanTs = String(ts).trim();
  if (!cleanTs) return null;
  
  // If it's already an ISO string with timezone info (e.g., ends in 'Z' or has +05:30 offset)
  if (cleanTs.endsWith('Z') || cleanTs.includes('+') || cleanTs.includes('GMT')) {
    return new Date(cleanTs);
  }
  
  // If it's standard SQLite date format 'YYYY-MM-DD HH:MM:SS'
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(cleanTs)) {
    return new Date(cleanTs.replace(' ', 'T') + 'Z');
  }
  
  // If it's standard SQLite date format 'YYYY-MM-DD'
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanTs)) {
    return new Date(cleanTs + 'T00:00:00Z');
  }
  
  // Fallback
  return new Date(cleanTs);
}

export function formatLocalDatetime(ts) {
  const date = parseDbDate(ts);
  if (!date || isNaN(date.getTime())) return String(ts || '');
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatLocalDate(ts) {
  const date = parseDbDate(ts);
  if (!date || isNaN(date.getTime())) return String(ts || '');
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
