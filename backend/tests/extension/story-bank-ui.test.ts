import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

/**
 * Tests for Story Bank UI flow in the side panel.
 * Simulates the render + handler attachment pattern to catch
 * double-handler bugs (e.g. toggle firing twice = no visible effect).
 */
describe('Story Bank UI', () => {
  let dom: JSDOM;
  let document: Document;

  const STORY_ICONS: Record<string, string> = {
    win: '&#x1F3C6;', lesson: '&#x1F4A1;', opinion: '&#x1F525;',
    project: '&#x1F680;', milestone: '&#x1F4CD;', daily_log: '&#x1F4DD;',
  };

  function renderStoryBank(entries: any[] = []) {
    return `<div style="padding-bottom:16px">
      <div style="padding:20px 16px 16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:18px;font-weight:700">Story Bank</span>
          <div style="display:flex;gap:8px">
            <button id="btn-add-story" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-weight:500">+ Add</button>
            <button id="btn-sb-back" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-weight:500">Back</button>
          </div>
        </div>
      </div>

      <div id="story-add-panel" style="display:none;margin:12px 14px 0">
        <div style="background:#fff;border:1px solid #e9e5f5;border-radius:12px;padding:14px">
          <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:#1e293b">Add a Story</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
            ${['win', 'lesson', 'opinion', 'project', 'milestone', 'daily_log'].map(t =>
              `<button data-stype="${t}" class="stype-btn" style="padding:4px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;cursor:pointer;background:#fff;color:#374151">${STORY_ICONS[t]} ${t.replace('_', ' ')}</button>`
            ).join('')}
          </div>
          <textarea id="story-content" rows="3" maxlength="1000" placeholder="Story..." style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;box-sizing:border-box"></textarea>
          <input id="story-tags" type="text" placeholder="Tags" style="width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;box-sizing:border-box" />
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button id="btn-cancel-story" style="padding:6px 14px;background:#f3f4f6;color:#6b7280;border:none;border-radius:6px;font-size:12px;cursor:pointer">Cancel</button>
            <button id="btn-save-story" style="padding:6px 14px;background:#7c3aed;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-weight:500">Save</button>
          </div>
        </div>
      </div>

      <div style="margin:12px 14px 0">
        ${entries.length === 0 ? `<div style="text-align:center;padding:32px 16px;color:#9ca3af">No stories yet</div>` :
          entries.map(e => `
            <div style="background:#fff;border:1px solid #f3f4f6;border-radius:10px;padding:12px;margin-bottom:8px">
              <span style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7c3aed">${e.entry_type}</span>
              <div style="font-size:13px;color:#374151">${e.content}</div>
              <button data-del-story="${e.id}" style="background:none;border:none;cursor:pointer">x</button>
            </div>
          `).join('')}
      </div>
    </div>`;
  }

  function attachStoryBankHandlers(doc: Document, callbacks: {
    onBack?: () => void;
    onSave?: (type: string, content: string, tags: string[]) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
  } = {}) {
    let selectedType = 'win';

    doc.getElementById('btn-sb-back')?.addEventListener('click', () => {
      callbacks.onBack?.();
    });

    doc.getElementById('btn-add-story')?.addEventListener('click', () => {
      const panel = doc.getElementById('story-add-panel');
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    doc.getElementById('btn-cancel-story')?.addEventListener('click', () => {
      const panel = doc.getElementById('story-add-panel');
      if (panel) panel.style.display = 'none';
    });

    doc.querySelectorAll('.stype-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedType = (btn as HTMLElement).dataset.stype || 'win';
      });
    });

    doc.getElementById('btn-save-story')?.addEventListener('click', async () => {
      const content = (doc.getElementById('story-content') as HTMLTextAreaElement)?.value?.trim();
      const tagsStr = (doc.getElementById('story-tags') as HTMLInputElement)?.value || '';
      const tags = tagsStr.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      if (!content) return;
      await callbacks.onSave?.(selectedType, content, tags);
    });

    doc.querySelectorAll('[data-del-story]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.delStory!;
        await callbacks.onDelete?.(id);
      });
    });
  }

  beforeEach(() => {
    dom = new JSDOM(`<html><body><div id="app"></div></body></html>`, { url: 'http://localhost' });
    document = dom.window.document;
  });

  it('clicking + Add shows the story form panel', () => {
    document.getElementById('app')!.innerHTML = renderStoryBank();
    attachStoryBankHandlers(document);

    const panel = document.getElementById('story-add-panel')!;
    expect(panel.style.display).toBe('none');

    document.getElementById('btn-add-story')!.click();
    expect(panel.style.display).toBe('block');
  });

  it('clicking Cancel hides the story form panel', () => {
    document.getElementById('app')!.innerHTML = renderStoryBank();
    attachStoryBankHandlers(document);

    document.getElementById('btn-add-story')!.click();
    expect(document.getElementById('story-add-panel')!.style.display).toBe('block');

    document.getElementById('btn-cancel-story')!.click();
    expect(document.getElementById('story-add-panel')!.style.display).toBe('none');
  });

  it('clicking + Add toggles panel visibility', () => {
    document.getElementById('app')!.innerHTML = renderStoryBank();
    attachStoryBankHandlers(document);

    const btn = document.getElementById('btn-add-story')!;
    const panel = document.getElementById('story-add-panel')!;

    btn.click();
    expect(panel.style.display).toBe('block');

    btn.click();
    expect(panel.style.display).toBe('none');

    btn.click();
    expect(panel.style.display).toBe('block');
  });

  it('BUG: + Add button still works after re-render (no double handlers)', () => {
    // This is the actual bug scenario:
    // 1. Render story bank
    // 2. User saves a story
    // 3. render() is called which sets innerHTML + attachStoryBankHandlers()
    // 4. If attachStoryBankHandlers() is called AGAIN, toggle fires twice = broken

    // First render
    document.getElementById('app')!.innerHTML = renderStoryBank();
    attachStoryBankHandlers(document);

    // Simulate what happens after save: re-render with a new entry
    const newEntries = [{ id: 1, entry_type: 'win', content: 'Shipped in 2 days', tags: ['speed'], used_count: 0 }];
    document.getElementById('app')!.innerHTML = renderStoryBank(newEntries);

    // This is the correct behavior: attach handlers exactly ONCE
    attachStoryBankHandlers(document);

    // + Add should work
    const panel = document.getElementById('story-add-panel')!;
    expect(panel.style.display).toBe('none');

    document.getElementById('btn-add-story')!.click();
    expect(panel.style.display).toBe('block');
  });

  it('BUG REPRO: double attachStoryBankHandlers breaks + Add toggle', () => {
    // This reproduces the exact bug: calling attachStoryBankHandlers twice
    // makes the toggle fire twice (open -> close) so panel stays hidden

    document.getElementById('app')!.innerHTML = renderStoryBank();
    attachStoryBankHandlers(document);
    attachStoryBankHandlers(document); // BUG: second call

    const panel = document.getElementById('story-add-panel')!;
    document.getElementById('btn-add-story')!.click();

    // With double handlers, panel toggles to 'block' then back to 'none'
    expect(panel.style.display).toBe('none'); // This proves the bug exists
  });

  it('save callback receives correct type, content, and tags', async () => {
    document.getElementById('app')!.innerHTML = renderStoryBank();
    const onSave = vi.fn();
    attachStoryBankHandlers(document, { onSave });

    // Open form
    document.getElementById('btn-add-story')!.click();

    // Select "lesson" type
    const lessonBtn = document.querySelector('[data-stype="lesson"]') as HTMLElement;
    lessonBtn.click();

    // Fill in content and tags
    (document.getElementById('story-content') as HTMLTextAreaElement).value = 'Learned TDD the hard way';
    (document.getElementById('story-tags') as HTMLInputElement).value = 'testing, tdd';

    // Save
    await document.getElementById('btn-save-story')!.click();

    expect(onSave).toHaveBeenCalledWith('lesson', 'Learned TDD the hard way', ['testing', 'tdd']);
  });

  it('save does nothing with empty content', async () => {
    document.getElementById('app')!.innerHTML = renderStoryBank();
    const onSave = vi.fn();
    attachStoryBankHandlers(document, { onSave });

    document.getElementById('btn-add-story')!.click();
    (document.getElementById('story-content') as HTMLTextAreaElement).value = '   ';

    await document.getElementById('btn-save-story')!.click();

    expect(onSave).not.toHaveBeenCalled();
  });

  it('delete callback receives correct story ID', async () => {
    const entries = [
      { id: 42, entry_type: 'win', content: 'Story to delete', tags: [], used_count: 0 },
    ];
    document.getElementById('app')!.innerHTML = renderStoryBank(entries);
    const onDelete = vi.fn();
    attachStoryBankHandlers(document, { onDelete });

    const delBtn = document.querySelector('[data-del-story="42"]') as HTMLElement;
    await delBtn.click();

    expect(onDelete).toHaveBeenCalledWith('42');
  });

  it('renders entries with correct content', () => {
    const entries = [
      { id: 1, entry_type: 'win', content: 'Shipped the feature', tags: ['speed'], used_count: 3 },
      { id: 2, entry_type: 'lesson', content: 'Never skip tests', tags: [], used_count: 0 },
    ];
    document.getElementById('app')!.innerHTML = renderStoryBank(entries);

    const html = document.getElementById('app')!.innerHTML;
    expect(html).toContain('Shipped the feature');
    expect(html).toContain('Never skip tests');
    expect(html).toContain('win');
    expect(html).toContain('lesson');
  });

  it('shows empty state when no entries', () => {
    document.getElementById('app')!.innerHTML = renderStoryBank([]);
    expect(document.getElementById('app')!.innerHTML).toContain('No stories yet');
  });

  it('type selector updates selected type', () => {
    document.getElementById('app')!.innerHTML = renderStoryBank();
    let capturedType = '';
    attachStoryBankHandlers(document, {
      onSave: async (type) => { capturedType = type; },
    });

    // Default is 'win'
    document.getElementById('btn-add-story')!.click();
    (document.getElementById('story-content') as HTMLTextAreaElement).value = 'Test';
    document.getElementById('btn-save-story')!.click();
    expect(capturedType).toBe('win');

    // Change to 'opinion'
    (document.querySelector('[data-stype="opinion"]') as HTMLElement).click();
    (document.getElementById('story-content') as HTMLTextAreaElement).value = 'Hot take';
    document.getElementById('btn-save-story')!.click();
    expect(capturedType).toBe('opinion');
  });
});
