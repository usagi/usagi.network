export function completedYears(startValue, endValue)
{
 const start = new Date(startValue || '');
 const end = new Date(endValue || '');
 if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
 let years = end.getUTCFullYear() - start.getUTCFullYear();
 const anniversaryPassed = end.getUTCMonth() > start.getUTCMonth()
  || (end.getUTCMonth() === start.getUTCMonth() && end.getUTCDate() >= start.getUTCDate());
 if (!anniversaryPassed) years -= 1;
 return Math.max(0, years);
}

export function formatBytes(value)
{
 const bytes = Number(value || 0);
 if (!Number.isFinite(bytes) || bytes <= 0) return '';
 if (bytes < 1024) return `${bytes} B`;
 return `${(bytes / 1024).toFixed(1)} KiB`;
}
