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
import { useEffect, useState, useRef } from 'react';

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
  const { content, setContent, history, getPastState } = useLegitFile("/document.txt", {
    initialContent: JSON.stringify(initialValue),
  });
  const [editorValue, setEditorValue] = useState(initialValue);
  const isRollingBackRef = useRef(false);

  useEffect(() => {
    console.log(content);
  }, [content]);

  useEffect(() => {
    console.log(history);
  }, [history]);

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
    value: editorValue,
  });

  return (
    <Plate editor={editor} onChange={({ value }) => {
      if (!isRollingBackRef.current) {
        setEditorValue(value);
      }
    }}>
      <FixedToolbar className="flex gap-1 justify-between rounded-t-lg p-2">
        <div className="flex gap-1">
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
        </div>
        
        <ToolbarButton variant="primary" onClick={() => {
          setContent(JSON.stringify(editorValue));
        }}>
          Save
        </ToolbarButton>
      </FixedToolbar>

      <div className="h-[300px] overflow-y-auto">
        <EditorContainer>
          <Editor placeholder="Type your amazing content here..." />
        </EditorContainer>
      </div>
      <div className="mt-4 pt-4 px-4 border rounded-lg mx-4">
        <h3 className="text-sm font-semibold mb-4">History</h3>
        <div className="h-[180px] overflow-y-auto">
          {history && history.length > 0 ? (
            <Timeline 
              history={history} 
              onRollback={async (oid) => {
                const pastContent = await getPastState(oid);
                if (pastContent) {
                  const parsedValue = JSON.parse(pastContent);
                  isRollingBackRef.current = true;
                  
                  // Use Plate's setValue method to update the editor content
                  // This is the recommended way to make external changes to editor content
                  editor.tf.setValue(parsedValue);
                  
                  // Update state to match
                  setEditorValue(parsedValue);
                  setContent(pastContent);
                  
                  // Focus the editor at the end
                  editor.tf.focus({ edge: 'endEditor' });
                  
                  // Reset flag after a moment
                  setTimeout(() => {
                    isRollingBackRef.current = false;
                  }, 100);
                }
              }}
            />
          ) : (
            <div className="text-sm text-muted-foreground">No history yet</div>
          )}
        </div>
      </div>
    </Plate>
  );
}
