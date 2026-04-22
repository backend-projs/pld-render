import React, { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { keymap, EditorView, Decoration, WidgetType } from '@codemirror/view';
import { Prec, StateField, StateEffect } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { acceptCompletion } from '@codemirror/autocomplete';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

const BADGE_COLORS = [
    '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', 
    '#0891b2', '#db2777', '#4f46e5', '#059669', '#ea580c',
    '#c026d3', '#2563eb', '#9333ea', '#4d7c0f', '#b45309',
    '#be123c', '#1d4ed8', '#047857', '#a21caf', '#6d28d9'
];

const getBadgeColor = (userId) => {
    if (!userId) return BADGE_COLORS[0];
    let hash = 0;
    for (let i = 0; i < String(userId).length; i++) {
        hash = String(userId).charCodeAt(i) + ((hash << 5) - hash);
    }
    return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length];
};

class BadgeWidget extends WidgetType {
    constructor(name, color, timestamp, isFirstLine) {
        super();
        this.name = name;
        this.color = color;
        this.timestamp = timestamp;
        this.isFirstLine = isFirstLine;
    }
    eq(other) { return other.timestamp === this.timestamp; }
    toDOM() {
        const span = document.createElement("span");
        span.className = "edit-badge-container";
        span.style.cssText = "display: inline-block; position: relative; width: 0; height: 0; vertical-align: baseline; pointer-events: none; user-select: none; z-index: 100;";
        
        const badge = document.createElement("span");
        badge.textContent = this.name;
        
        if (this.isFirstLine) {
            // Pointing Down (For Line 1 and 2)
            badge.style.cssText = `
                position: absolute;
                top: 0.9em;
                left: 0;
                transform: translateY(4px);
                background-color: ${this.color};
                color: white;
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: bold;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                display: inline-block;
                animation: badge-pop-down 3.5s cubic-bezier(0.2, 0, 0.2, 1) forwards;
                border: 1px solid rgba(255,255,255,0.2);
            `;
            const arrow = document.createElement("div");
            arrow.style.cssText = `
                position: absolute;
                bottom: 100%;
                left: 10px;
                border-width: 5px;
                border-style: solid;
                border-color: transparent transparent ${this.color} transparent;
            `;
            badge.appendChild(arrow);
        } else {
            // Pointing Up (For all other lines)
            badge.style.cssText = `
                position: absolute;
                bottom: 1.4em;
                left: 0;
                transform: translateY(-4px);
                background-color: ${this.color};
                color: white;
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: bold;
                white-space: nowrap;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                display: inline-block;
                animation: badge-pop 3.5s cubic-bezier(0.2, 0, 0.2, 1) forwards;
                border: 1px solid rgba(255,255,255,0.2);
            `;
            const arrow = document.createElement("div");
            arrow.style.cssText = `
                position: absolute;
                top: 100%;
                left: 10px;
                border-width: 5px;
                border-style: solid;
                border-color: ${this.color} transparent transparent transparent;
            `;
            badge.appendChild(arrow);
        }
        
        const cursorLine = document.createElement("div");
        cursorLine.style.cssText = `
            position: absolute;
            bottom: -0.2em;
            left: 0;
            width: 2px;
            height: 1.4em;
            background-color: ${this.color};
            animation: cursor-fade 3.5s ease-out forwards;
        `;
        
        span.appendChild(badge);
        span.appendChild(cursorLine);
        return span;
    }
}

const setBadge = StateEffect.define();
const clearBadge = StateEffect.define();

const badgeField = StateField.define({
    create() { return []; },
    update(badges, tr) {
        let newBadges = badges;
        
        if (tr.docChanged) {
            newBadges = newBadges.map(b => ({ ...b, pos: tr.changes.mapPos(b.pos) }));
        }
        
        for (let e of tr.effects) {
            if (e.is(setBadge)) {
                newBadges = newBadges.filter(b => b.userId !== e.value.userId);
                newBadges.push(e.value);
            }
            if (e.is(clearBadge)) {
                newBadges = newBadges.filter(b => b.timestamp !== e.value.timestamp);
            }
        }
        
        newBadges = newBadges.map(b => {
            if (b.pos > tr.state.doc.length) {
                return { ...b, pos: tr.state.doc.length };
            }
            return b;
        });
        
        return newBadges;
    },
    provide: f => EditorView.decorations.from(f, badges => {
        if (!badges || badges.length === 0) return Decoration.none;
        
        const decos = badges.map(val => {
            return Decoration.widget({
                widget: new BadgeWidget(val.name, val.color, val.timestamp, val.isFirstLine),
                side: 1
            }).range(val.pos);
        }).sort((a, b) => a.from - b.from);
        
        return Decoration.set(decos, true);
    })
});

export default function CodeEditor({ code, onChange, language = 'python', readOnly = false, remoteEdit = null }) {
    const { theme } = useTheme();
    const { user } = useAuth();
    const editorRef = useRef(null);
    const timersRef = useRef({});
    const lastRemoteTimestamp = useRef(null);

    useEffect(() => {
        if (remoteEdit && editorRef.current?.view) {
            const { userName, userId, pos, timestamp } = remoteEdit;
            
            if (lastRemoteTimestamp.current === timestamp) return;
            lastRemoteTimestamp.current = timestamp;

            setTimeout(() => {
                const view = editorRef.current?.view;
                if (!view) return;
                
                try {
                    const docLength = view.state.doc.length;
                    let parsedPos = typeof pos === 'number' ? pos : 0;
                    const targetPos = Math.max(0, Math.min(parsedPos, docLength));
                    const safeUserId = userId || 'remote';
                    
                    // Determine if the cursor is on the top lines (1 or 2)
                    const line = view.state.doc.lineAt(targetPos);
                    const isFirstLine = line.number <= 2;
                    
                    view.dispatch({
                        effects: setBadge.of({
                            userId: safeUserId,
                            name: userName,
                            color: getBadgeColor(safeUserId),
                            pos: targetPos,
                            timestamp: timestamp,
                            isFirstLine: isFirstLine
                        })
                    });

                    if (timersRef.current[safeUserId]) clearTimeout(timersRef.current[safeUserId]);
                    timersRef.current[safeUserId] = setTimeout(() => {
                        if (editorRef.current?.view) {
                            editorRef.current.view.dispatch({ effects: clearBadge.of({ timestamp }) });
                        }
                    }, 3500);
                } catch (e) {
                    console.error("Failed to show remote badge:", e);
                }
            }, 300);
        }
    }, [remoteEdit]);

    const getLanguageExtension = () => {
        switch (language) {
            case 'python': return python();
            case 'cpp': return cpp();
            case 'javascript':
            default: return javascript({ jsx: true });
        }
    };

    return (
        <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', height: '100%', opacity: readOnly ? 0.7 : 1 }}>
            <style>{`
                @keyframes badge-pop {
                    0% { opacity: 0; transform: translateY(10px) scale(0.8); }
                    5.7% { opacity: 1; transform: translateY(-4px) scale(1); }
                    91.4% { opacity: 1; transform: translateY(-4px) scale(1); }
                    100% { opacity: 0; transform: translateY(-10px) scale(0.9); }
                }
                @keyframes badge-pop-down {
                    0% { opacity: 0; transform: translateY(-10px) scale(0.8); }
                    5.7% { opacity: 1; transform: translateY(4px) scale(1); }
                    91.4% { opacity: 1; transform: translateY(4px) scale(1); }
                    100% { opacity: 0; transform: translateY(10px) scale(0.9); }
                }
                @keyframes cursor-fade {
                    0% { opacity: 1; }
                    91.4% { opacity: 1; }
                    100% { opacity: 0; }
                }
                .cm-editor { height: 100% !important; min-height: 300px; }
                .cm-scroller { min-height: 100% !important; overflow: auto; }
                .cm-content { min-height: 100% !important; }
            `}</style>
            <CodeMirror
                ref={editorRef}
                value={code}
                height="100%"
                theme={theme === 'dark' ? 'dark' : 'light'}
                basicSetup={{
                    indentWithTab: false,
                }}
                extensions={[
                    getLanguageExtension(),
                    Prec.highest(keymap.of([
                        { key: 'Tab', run: acceptCompletion }
                    ])),
                    keymap.of([
                        indentWithTab
                    ]),
                    badgeField
                ]}
                onChange={onChange}
                readOnly={readOnly}
                style={{ fontSize: '14px', minHeight: '300px' }}
            />
        </div>
    );
}

