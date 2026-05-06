export interface ChoiceOption {
  letter: string;
  text: string;
}

export interface ChoiceBlock {
  type: 'choices';
  id: string;
  question: string;
  options: ChoiceOption[];
}

export interface MarkdownBlock {
  type: 'markdown';
  id: string;
  content: string;
}

export type MessagePart = MarkdownBlock | ChoiceBlock;

// Matches lines like "a. text", "b) text", "A. text"
// Also tolerates leading spaces/dashes: "  a. text", "- a. text", "* a. text"
const OPTION_RE = /^[\s\-*]*([a-dA-D])[.)]\s+(.+)$/;

export function parseAgentMessage(text: string): MessagePart[] {
  const lines = text.split('\n');
  const parts: MessagePart[] = [];
  let pendingLines: string[] = [];
  let partIdx = 0;

  const flushPending = () => {
    const content = pendingLines.join('\n').trim();
    if (content) {
      parts.push({ type: 'markdown', id: `md-${partIdx++}`, content });
    }
    pendingLines = [];
  };

  let i = 0;
  while (i < lines.length) {
    const match = lines[i].match(OPTION_RE);
    if (match) {
      // Collect consecutive option lines (allow blank lines between options)
      const options: ChoiceOption[] = [];
      while (i < lines.length) {
        const m = lines[i].match(OPTION_RE);
        if (m) {
          options.push({ letter: m[1].toLowerCase(), text: m[2].trim() });
          i++;
        } else if (lines[i].trim() === '' && i + 1 < lines.length && lines[i + 1].match(OPTION_RE)) {
          // Skip a single blank line between options
          i++;
        } else {
          break;
        }
      }

      if (options.length >= 2) {
        // Pull the preceding paragraph off pendingLines as the question text
        const fullPending = pendingLines.join('\n').trimEnd();
        const lastBlankIdx = fullPending.lastIndexOf('\n\n');
        let questionText = '';

        if (lastBlankIdx >= 0) {
          const before = fullPending.slice(0, lastBlankIdx).trim();
          questionText = fullPending.slice(lastBlankIdx + 2).trim();
          pendingLines = before ? [before] : [];
          flushPending();
        } else {
          questionText = fullPending;
          pendingLines = [];
        }

        parts.push({
          type: 'choices',
          id: `choices-${partIdx++}`,
          question: questionText,
          options,
        });
      } else {
        // Not enough options — treat as plain text
        for (const o of options) {
          pendingLines.push(`${o.letter}. ${o.text}`);
        }
      }
    } else {
      pendingLines.push(lines[i]);
      i++;
    }
  }

  flushPending();
  return parts;
}
