import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link2,
  Undo2,
  Redo2,
  Heading2,
  Heading3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function ToolbarButton({ active, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-lg p-1.5 text-navy transition-colors hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-40',
        active && 'bg-gold/20 text-gold',
      )}
    >
      {children}
    </button>
  )
}

function EditorToolbar({ editor }) {
  if (!editor) return null

  const setLink = () => {
    const previous = editor.getAttributes('link').href
    const url = window.prompt('Link URL (https://, http://, or mailto:)', previous || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gold/20 bg-ivory-3 px-2 py-1.5">
      <ToolbarButton
        title="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-gold/25" aria-hidden />

      <ToolbarButton
        title="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-gold/25" aria-hidden />

      <ToolbarButton
        title="Bullet list (Tab to indent)"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list (Tab to indent)"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Block quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Horizontal line"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-gold/25" aria-hidden />

      <ToolbarButton
        title="Add link"
        active={editor.isActive('link')}
        onClick={setLink}
      >
        <Link2 className="h-4 w-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-gold/25" aria-hidden />

      <ToolbarButton
        title="Undo"
        disabled={!editor.can().chain().focus().undo().run()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Redo"
        disabled={!editor.can().chain().focus().redo().run()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
    </div>
  )
}

/** Normalize editor HTML — empty doc becomes blank string for validation. */
export function normalizeEditorHtml(html) {
  const raw = String(html || '').trim()
  if (!raw || raw === '<p></p>' || raw === '<p><br></p>') return ''
  return raw
}

/**
 * WYSIWYG CMS editor — outputs HTML allowed by the server sanitizer.
 */
export function CmsRichTextEditor({
  value,
  onChange,
  dir = 'ltr',
  placeholder = 'Write page content…',
  className,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        strike: false,
        code: false,
        codeBlock: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        dir,
        class: cn(
          'cms-rich-text-editor min-h-[220px] max-w-none px-4 py-3 text-sm text-navy focus:outline-none',
          dir === 'rtl' && 'text-right',
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(normalizeEditorHtml(ed.getHTML()))
    },
  })

  useEffect(() => {
    if (!editor) return
    const next = value || ''
    const current = editor.getHTML()
    if (normalizeEditorHtml(current) === normalizeEditorHtml(next)) return
    editor.commands.setContent(next, false)
  }, [editor, value])

  useEffect(() => {
    if (!editor) return
    editor.setOptions({
      editorProps: {
        attributes: {
          dir,
          class: cn(
            'cms-rich-text-editor min-h-[220px] max-w-none px-4 py-3 text-sm text-navy focus:outline-none',
            dir === 'rtl' && 'text-right',
          ),
        },
      },
    })
  }, [editor, dir])

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-gold/20 bg-ivory-2',
        className,
      )}
    >
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
