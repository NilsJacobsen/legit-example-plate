'use client';

import type { Value } from 'platejs';

import {
  BlockquotePlugin,
  BoldPlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  ItalicPlugin,
  UnderlinePlugin,
} from '@platejs/basic-nodes/react';
import { Plate, usePlateEditor } from 'platejs/react';

import { BlockquoteElement } from '@/components/ui/blockquote-node';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { FixedToolbar } from '@/components/ui/fixed-toolbar';
import { H1Element, H2Element, H3Element } from '@/components/ui/heading-node';
import { MarkToolbarButton } from '@/components/ui/mark-toolbar-button';
import { Timeline } from '@/components/ui/timeline';
import { ToolbarButton } from '@/components/ui/toolbar';
import { useLegitFile } from '@legit-sdk/react';
import { useEffect, useState } from 'react';

const initialValue: Value = [
  {
    children: [{ text: 'Title' }],
    type: 'h3',
  },
  {
    children: [{ text: 'This is a quote.' }],
    type: 'blockquote',
  },
  {
    children: [
      { text: 'With some ' },
      { bold: true, text: 'bold' },
      { text: ' text for emphasis!' },
    ],
    type: 'p',
  },
];

export default function MyEditorPage() {
  const editor = usePlateEditor({
    plugins: [
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
      H1Plugin.withComponent(H1Element),
      H2Plugin.withComponent(H2Element),
      H3Plugin.withComponent(H3Element),
      BlockquotePlugin.withComponent(BlockquoteElement),
    ],
    value: initialValue,
  });
  const { content, setContent, history } = useLegitFile("/document.txt", {
    initialContent: JSON.stringify(initialValue),
  });
  const [editorValue, setEditorValue] = useState(initialValue);

  useEffect(() => {
    console.log(content);
  }, [content]);

  useEffect(() => {
    console.log(history);
  }, [history]);

  return (
    <Plate editor={editor} onChange={({ value }) => {
      setEditorValue(value);
    }}>
      <FixedToolbar className="flex justify-start gap-1 rounded-t-lg">
        <ToolbarButton onClick={() => editor.tf.h1.toggle()}>H1</ToolbarButton>
        <ToolbarButton onClick={() => editor.tf.h2.toggle()}>H2</ToolbarButton>
        <ToolbarButton onClick={() => editor.tf.h3.toggle()}>H3</ToolbarButton>

        <ToolbarButton onClick={() => editor.tf.blockquote.toggle()}>
          Quote
        </ToolbarButton>

        <MarkToolbarButton nodeType="bold" tooltip="Bold (⌘+B)">
          B
        </MarkToolbarButton>
        <MarkToolbarButton nodeType="italic" tooltip="Italic (⌘+I)">
          I
        </MarkToolbarButton>
        <MarkToolbarButton nodeType="underline" tooltip="Underline (⌘+U)">
          U
        </MarkToolbarButton>
        <ToolbarButton variant="primary" onClick={() => {
          setContent(JSON.stringify(editorValue));
        }}>
          Save
        </ToolbarButton>
      </FixedToolbar>

      <EditorContainer>
        <Editor placeholder="Type your amazing content here..." />
      </EditorContainer>
      <div className="mt-8 p-4 border rounded-lg mx-8">
        <h3 className="text-sm font-semibold mb-4">History</h3>
        {history && history.length > 0 ? (
          <Timeline history={history} />
        ) : (
          <div className="text-sm text-muted-foreground">No history yet</div>
        )}
      </div>
    </Plate>
  );
}
