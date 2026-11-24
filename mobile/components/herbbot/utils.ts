// Membersihkan sisa sintaks JSON lama bila masih tersimpan di riwayat database
export function sanitizeDisplayText(raw: string): string {
  const trimmed = (raw || '').trim();
  if (trimmed.startsWith('{') && trimmed.includes('"reply"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.reply === 'string') {
        return parsed.reply.trim();
      }
    } catch {
      const extracted = trimmed
        .replace(/^\{\s*"reply"\s*:\s*"?/i, '')
        .replace(/"?\s*,?\s*"suggestions"\s*:[\s\S]*$/i, '')
        .replace(/"\s*\}$/, '')
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"');
      return extracted.trim();
    }
  }
  return trimmed.replace(/<<<SUGGESTIONS>>>[\s\S]*$/g, '').trim();
}
