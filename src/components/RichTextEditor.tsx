import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useEffect, useState } from 'react';
import { useDialog } from '@/contexts/DialogContext';
import {
  Bold, Italic, Heading2, Heading3, Quote, List, ListOrdered,
  Link as LinkIcon, Code, Eye, Undo2, Redo2, Strikethrough,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Force the initial mode (default: WYSIWYG). */
  initialMode?: 'wysiwyg' | 'html';
}

function normalizeSafeHref(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const href = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const compact = Array.from(href)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 0x1f && code !== 0x7f && !/\s/.test(ch);
    })
    .join('');
  try {
    const parsed = new URL(compact);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Tiptap-based rich-text editor with a WYSIWYG↔HTML mode toggle.
 *
 * Storage shape: a single HTML string. The component is a controlled-ish
 * wrapper: it reflects external `value` changes (e.g. when the parent flips
 * the active locale tab) without losing the cursor for normal typing.
 */
export function RichTextEditor({ value, onChange, placeholder, initialMode = 'wysiwyg' }: Props) {
  const [mode, setMode] = useState<'wysiwyg' | 'html'>(initialMode);
  const { prompt } = useDialog();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => normalizeSafeHref(url) !== null,
        shouldAutoLink: (url) => normalizeSafeHref(url) !== null,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[260px] p-4 text-text-primary',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Reflect external value changes (e.g. when the parent switches locales).
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const Btn = ({
    onClick, active, disabled, title, children,
  }: { onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-brand-primary/20 text-brand-primary'
          : 'text-text-secondary hover:bg-glass-hover disabled:opacity-40'
      }`}
    >
      {children}
    </button>
  );

  const Sep = () => <span className="w-px h-5 bg-glass-border mx-1" />;

  const promptLink = async () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const href = await prompt({
      title: 'Link',
      message: 'URL:',
      defaultValue: previous || 'https://',
      placeholder: 'https://example.com',
      inputType: 'url',
    });
    if (href === null) return;           // cancelled
    if (href === '') {                    // cleared → unset
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const safeHref = normalizeSafeHref(href);
    if (!safeHref) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: safeHref }).run();
  };

  return (
    <div className="border border-glass-border rounded-md overflow-hidden bg-bg-primary">
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-glass-border bg-glass-element">
        {mode === 'wysiwyg' ? (
          <>
            <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo"><Undo2 className="w-3.5 h-3.5" /></Btn>
            <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo"><Redo2 className="w-3.5 h-3.5" /></Btn>
            <Sep />
            <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold className="w-3.5 h-3.5" /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic className="w-3.5 h-3.5" /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></Btn>
            <Sep />
            <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 className="w-3.5 h-3.5" /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 className="w-3.5 h-3.5" /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote"><Quote className="w-3.5 h-3.5" /></Btn>
            <Sep />
            <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list"><List className="w-3.5 h-3.5" /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list"><ListOrdered className="w-3.5 h-3.5" /></Btn>
            <Sep />
            <Btn onClick={promptLink} active={editor.isActive('link')} title="Insert / edit link"><LinkIcon className="w-3.5 h-3.5" /></Btn>
          </>
        ) : (
          <span className="text-xs text-text-muted px-1">Editing raw HTML</span>
        )}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'wysiwyg' ? 'html' : 'wysiwyg'))}
            className="text-xs px-2 py-1 rounded bg-glass-hover text-text-secondary hover:bg-glass-element flex items-center gap-1"
            title="Toggle WYSIWYG / HTML"
          >
            {mode === 'wysiwyg' ? <Code className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {mode === 'wysiwyg' ? 'HTML' : 'WYSIWYG'}
          </button>
        </div>
      </div>

      {mode === 'wysiwyg' ? (
        <EditorContent editor={editor} />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || '<p>Paste raw HTML here…</p>'}
          rows={18}
          className="w-full p-3 text-xs font-mono text-text-primary bg-bg-primary border-0 focus:outline-none resize-vertical"
        />
      )}
    </div>
  );
}
