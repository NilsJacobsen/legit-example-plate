"use client";

import { useEffect, useState, useRef } from "react";
import fs from "memfs";
import { openLegitFs, HistoryItem } from "@legit-sdk/core";
import Image from "next/image";
import Link from "next/link";
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
import { MarkdownPlugin, deserializeMd } from '@platejs/markdown';
import { Plate, usePlateEditor } from 'platejs/react';

import { BlockquoteElement } from '@/components/ui/blockquote-node';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { FixedToolbar } from '@/components/ui/fixed-toolbar';
import { H1Element, H2Element, H3Element } from '@/components/ui/heading-node';
import { MarkToolbarButton } from '@/components/ui/mark-toolbar-button';
import { ToolbarButton } from '@/components/ui/toolbar';
import { Timeline } from '@/components/ui/timeline';

const INITIAL_MARKDOWN = "# Title\n\nThis is a document that you can edit! 🖋️\n\nWith some **bold** text for emphasis!";
const FILE_NAME = "document.txt";

const initialValue: Value = [
  {
    children: [{ text: 'Title' }],
    type: 'h1',
  },
  {
    children: [{ text: 'This is a document that you can edit! 🖋️' }],
    type: 'p',
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

export default function Home() {
  const [legitFs, setLegitFs] = useState<Awaited<ReturnType<typeof openLegitFs>> | null>(null);
  const [history, setHistory] = useState<(HistoryItem & { oldContent: string; newContent: string })[]>([]);
  const [checkoutOid, setCheckoutOid] = useState<string | null>(null);
  const headRef = useRef<string | null>(null);
  const isRollingBackRef = useRef(false);

  const [editorValue, setEditorValue] = useState(initialValue);

  const editor = usePlateEditor({
    plugins: [
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
      H1Plugin.withComponent(H1Element),
      H2Plugin.withComponent(H2Element),
      H3Plugin.withComponent(H3Element),
      BlockquotePlugin.withComponent(BlockquoteElement),
      MarkdownPlugin,
    ],
    value: editorValue,
  });

  // Helper function to serialize current editor value to markdown
  const serializeToMarkdown = () => {
    return editor.getApi(MarkdownPlugin).markdown.serialize();
  };

  // Helper function to deserialize markdown to Plate value
  const deserializeFromMarkdown = (markdown: string) => {
    return deserializeMd(editor, markdown);
  };

  // Get file content from a commit
  const getCommitContent = async (oid: string | null) => {
    if (!oid || !legitFs) return "";
    try {
      return await legitFs.promises.readFile(`/.legit/commits/${oid.slice(0, 2)}/${oid.slice(2)}/${FILE_NAME}`, "utf8") as string;
    } catch {
      return ""
    }
  };

  // Checkout a commit (used by Timeline's onRollback)
  const checkoutCommit = async (oid: string) => {
    const content = await getCommitContent(oid);
    if (content) {
      const parsedValue = deserializeFromMarkdown(content);
      isRollingBackRef.current = true;
      editor.tf.setValue(parsedValue);
      setEditorValue(parsedValue);
      setCheckoutOid(oid);
      editor.tf.focus({ edge: 'endEditor' });
      setTimeout(() => {
        isRollingBackRef.current = false;
      }, 100);
    }
  };

  // Wrapper for Timeline's getPastState prop
  const getPastState = async (oid: string): Promise<string | null> => {
    return await getCommitContent(oid);
  };

  // Save latest commit (only allowed on HEAD)
  const handleSave = async () => {
    if (!legitFs || checkoutOid !== history[0]?.oid) return;
    const currentMarkdown = serializeToMarkdown();
    await legitFs.promises.writeFile(`/.legit/branches/main/${FILE_NAME}`, currentMarkdown);

    // Get the new HEAD OID after the commit happens
    const newHead = await legitFs.promises.readFile(
      "/.legit/branches/main/.legit/head",
      "utf8"
    ) as string;
    setCheckoutOid(newHead);
  };

  // Initialize in-memory repo & and put a document.txt in it
  useEffect(() => {
    const initFs = async () => {
      try {
        if (!legitFs) {
          const _legitFs = await openLegitFs({
            storageFs: fs as unknown as typeof import("node:fs"),
            gitRoot: "/",
          });
          await _legitFs.promises.writeFile(`/.legit/branches/main/${FILE_NAME}`, INITIAL_MARKDOWN);
          setLegitFs(_legitFs);
        }
      } catch (err) {
        console.error("Failed to initialize LegitFS:", err);
      }
    };
    initFs();
  }, []);

  // Poll for HEAD changes only
  useEffect(() => {
    if (!legitFs) return;

    const pollHead = setInterval(async () => {
      try {
        const newHead = await legitFs.promises.readFile(
          "/.legit/branches/main/.legit/head",
          "utf8"
        ) as string;

        if (newHead && newHead !== headRef.current) {
          headRef.current = newHead;
          setCheckoutOid(newHead);
        }
      } catch (e) {
        console.error("Polling the head failed: ", e)
      }
      // polling with 200ms is fine because reading the head is really cheap
    }, 200);

    return () => clearInterval(pollHead);
  }, [legitFs]);

  // Fetch and enrich history when HEAD changes
  useEffect(() => {
    if (!legitFs || !checkoutOid) return;

    const updateHistory = async () => {
      try {
        const raw = await legitFs.promises.readFile(
          "/.legit/branches/main/.legit/history",
          "utf8"
        ) as string;
        if (!raw) return;

        const parsed: HistoryItem[] = JSON.parse(raw);
        const enriched = await Promise.all(
          parsed.map(async (h) => {
            const newContent = await getCommitContent(h.oid)
            const oldContent = await getCommitContent(h.parent[0])
            return { ...h, oldContent, newContent };
          })
        );

        const wasEmpty = history.length === 0;
        setHistory(enriched);

        // Update editor only on initial load when history is first populated
        if (wasEmpty && enriched.length > 0 && !isRollingBackRef.current) {
          const latest = enriched[0];
          const parsedValue = deserializeFromMarkdown(latest.newContent);
          setEditorValue(parsedValue);
        }
      } catch (e) {
        console.error("Not able to update history state: ", e)
      }
    };

    updateHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legitFs, checkoutOid]);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-white border-b border-gray-200 py-4 sticky top-0 z-[100]">
        <div className="grid max-w-7xl mx-auto grid-cols-2 px-4 items-center">
          <Link href="https://legitcontrol.com" className="text-xl font-semibold text-black no-underline">
            <Image alt="Legit Logo" src="/logo.svg" width={70} height={40} />
          </Link>
          <nav className="flex gap-8 items-center justify-end">
            <ul className="hidden md:flex gap-6 list-none" id="navLinks">
              <li><a href="https://www.legitcontrol.com/docs" className="text-gray-600 no-underline text-[0.9375rem] transition-colors duration-200 hover:text-legit-orange">Docs</a></li>
              <li><a href="https://replit.com/@jannes-blobel" className="text-gray-600 no-underline text-[0.9375rem] transition-colors duration-200 hover:text-legit-orange">Replit Examples</a></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full flex flex-col px-4">
        <h1 className="text-2xl font-semibold mt-8">Legit SDK Starter</h1>
        <p className="max-w-lg mb-8">
          This is just a small sample of what the Legit SDK can do. The goal is to make some features tangible. More functionality and examples will follow soon.
        </p>
        <div className="flex flex-row grid-row-2 gap-6 items-start">
          {/* Editor */}
          <div className="flex flex-col w-full border border-zinc-300 rounded-lg overflow-hidden flex-[2] min-h-[600px]">
            <div className="flex justify-between bg-zinc-100 px-3 py-2 border-b border-zinc-300 flex-shrink-0">
              <div className="flex gap-2 items-center">
                <Image alt="File" src="/file.svg" width={20} height={20} />
                {FILE_NAME}
              </div>
              <button
                onClick={handleSave}
                disabled={checkoutOid !== history[0]?.oid}
                className="bg-legit-orange text-white px-3 py-1 rounded-lg font-semibold hover:opacity-80 cursor-pointer disabled:opacity-50"
              >
                Save
              </button>
            </div>

            {/* NOTE: This is the insertion point where the Plate editor is used.
             * If you want to replace Plate with a different editor library, this is the main location to do so.
             * You may substitute this section with your preferred editor component, but you will also need to ensure it correctly
             * interacts with the app state (editorValue, setEditorValue, isRollingBackRef, etc). */}
            <div id="plate-editor-container">
            <Plate 
              editor={editor} 
              onChange={({ value }) => {
                // Prevent onChange from overwriting during rollback
                if (!isRollingBackRef.current) {
                  setEditorValue(value);
                }
              }}
            >
              <FixedToolbar className="flex gap-1 justify-between rounded-t-lg sm:p-2 border-b border-zinc-200">
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
              </FixedToolbar>

              <div className="flex-1 overflow-y-auto min-h-0">
                <EditorContainer variant="default" className="h-full">
                  <Editor 
                    placeholder="Type your amazing content here..." 
                    readOnly={checkoutOid !== history[0]?.oid}
                  />
                </EditorContainer>
              </div>
            </Plate>
            </div>
          </div>

          {/* History */}
          <div className="flex flex-col flex-[1] min-h-[600px] max-h-[600px]">
            <h2 className="mt-2 text-md font-semibold mb-2 flex-shrink-0">History</h2>
            <div className="flex flex-col gap-2 w-full overflow-y-auto flex-1 min-h-0">
              {history && history.length > 0 ? (
                <Timeline 
                  history={history}
                  getPastState={getPastState}
                  activeCommitOid={checkoutOid}
                  onRollback={checkoutCommit}
                />
              ) : (
                <div className="text-sm text-gray-500">No history yet</div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 w-full">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-6 text-sm text-gray-600">
            <p className="text-gray-600">
              This is made with <span className="text-legit-orange">LEGIT</span> &lt;3
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <a href="https://github.com/Legit-Control" target="_blank" rel="noopener noreferrer" className="hover:text-legit-orange transition-colors">GitHub</a>
              <a href="https://discord.gg/34K4t5K9Ra" target="_blank" rel="noopener noreferrer" className="hover:text-legit-orange transition-colors">Discord</a>
              <Link href="https://legitcontrol.com" className="hover:text-legit-orange transition-colors">
                Go to legitcontrol.com →
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
