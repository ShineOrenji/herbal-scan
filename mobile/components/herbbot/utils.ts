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

/** Teks polos tanpa simbol markdown (**tebal**, *miring*, ### judul) — untuk preview & bagikan teks */
export function stripMarkdown(raw: string): string {
  return sanitizeDisplayText(raw)
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^[\-\*]\s+/gm, '• ')
    .replace(/\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
