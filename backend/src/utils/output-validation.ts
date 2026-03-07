const CODE_BLOCK_PATTERN = /```[\s\S]*?```/;
const HTML_TAG_PATTERN = /<(?:script|style|iframe|object|embed|form)[^>]*>/i;

interface OutputLimits {
  maxLength: number;
  type: string;
}

const OUTPUT_LIMITS: Record<string, OutputLimits> = {
  'suggest-comment': { maxLength: 500, type: 'comment' },
  'draft-post': { maxLength: 3000, type: 'post' },
  'post-ideas': { maxLength: 2000, type: 'ideas' },
  'connection-note': { maxLength: 200, type: 'note' },
};

export function validateOutput(text: string, endpoint: string): { valid: boolean; text: string; reason?: string } {
  const limits = OUTPUT_LIMITS[endpoint];
  if (!limits) {
    return { valid: true, text };
  }

  // Check for code blocks
  if (CODE_BLOCK_PATTERN.test(text)) {
    return { valid: false, text: '', reason: 'Response contained code blocks.' };
  }

  // Check for dangerous HTML (script, style, iframe, object, embed, form)
  if (HTML_TAG_PATTERN.test(text)) {
    return { valid: false, text: '', reason: 'Response contained HTML tags.' };
  }

  // Truncate if needed
  let result = text;
  if (result.length > limits.maxLength) {
    result = result.substring(0, limits.maxLength);
  }

  return { valid: true, text: result };
}

export const FALLBACK_RESPONSE = 'Unable to generate suggestion. Please try a different input.';
