import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Accessibility Attributes', () => {
  it('NotificationBell should have aria-label and title on the main toggle button', () => {
    const filePath = path.resolve(__dirname, '../components/NotificationBell.tsx');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('aria-label="View notifications"');
    expect(content).toContain('title="View notifications"');
  });

  it('GlobalSearch should have aria-label and title on the search trigger', () => {
    const filePath = path.resolve(__dirname, '../components/GlobalSearch.tsx');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('aria-label="Open search"');
    expect(content).toContain('title="Open search (Cmd+K)"');
  });

  it('AIAssistant should have title on suggested tags', () => {
    const filePath = path.resolve(__dirname, '../components/AIAssistant.tsx');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('title={`Ask AI: ${tag.label}`}');
  });
});
