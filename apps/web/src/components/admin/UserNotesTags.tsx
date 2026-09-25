"use client";

import { useEffect, useState } from "react";
import {
  addUserNote,
  assignUserTag,
  createUserTag,
  deleteUserNote,
  getTagCatalog,
  getUserNotes,
  getUserTags,
  removeUserTag,
  type AdminUserNote,
  type AdminUserTag,
} from "../../lib/api";

const date = (value: string) => new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });

export default function UserNotesTags({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<AdminUserNote[]>([]);
  const [tags, setTags] = useState<AdminUserTag[]>([]);
  const [catalog, setCatalog] = useState<AdminUserTag[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    getUserNotes(userId)
      .then(setNotes)
      .catch(() => setNotes([]));
    getUserTags(userId)
      .then(setTags)
      .catch(() => setTags([]));
    getTagCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const submitNote = async () => {
    if (!noteBody.trim()) return;
    setBusy(true);
    try {
      await addUserNote(userId, noteBody.trim());
      setNoteBody("");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось добавить заметку");
    } finally {
      setBusy(false);
    }
  };
  const removeNote = async (noteId: string) => {
    setBusy(true);
    try {
      await deleteUserNote(userId, noteId);
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить заметку");
    } finally {
      setBusy(false);
    }
  };
  const submitTag = async () => {
    if (!newTag.trim()) return;
    setBusy(true);
    try {
      const tag = await createUserTag(newTag.trim(), null);
      await assignUserTag(userId, tag.id);
      setNewTag("");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось создать тег");
    } finally {
      setBusy(false);
    }
  };
  const toggleTag = async (tag: AdminUserTag) => {
    setBusy(true);
    try {
      if (tags.some((value) => value.id === tag.id)) await removeUserTag(userId, tag.id);
      else await assignUserTag(userId, tag.id);
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось изменить тег");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-notes">
      <h3>Заметки и теги</h3>
      {message && <p className="settings-muted">{message}</p>}
      <div className="admin-tag-row">
        {catalog.map((tag) => (
          <button
            key={tag.id}
            className={`admin-tag ${tags.some((value) => value.id === tag.id) ? "active" : ""}`}
            disabled={busy}
            onClick={() => toggleTag(tag)}
          >
            {tag.name}
          </button>
        ))}
        <input
          value={newTag}
          onChange={(event) => setNewTag(event.target.value)}
          placeholder="Новый тег"
          className="admin-tag-input"
        />
        <button className="ui-button ui-button-secondary" disabled={busy} onClick={submitTag}>
          Добавить тег
        </button>
      </div>
      <label className="admin-reason">
        Новая заметка
        <textarea
          value={noteBody}
          onChange={(event) => setNoteBody(event.target.value)}
          placeholder="Минимум 1 символ"
        />
      </label>
      <div className="admin-dialog-actions">
        <button className="ui-button ui-button-primary" disabled={busy || !noteBody.trim()} onClick={submitNote}>
          Добавить заметку
        </button>
      </div>
      <div className="admin-note-list">
        {notes.map((note) => (
          <div className="admin-note" key={note.id}>
            <p>{note.body}</p>
            <small>
              {date(note.createdAt)} · {note.authorUserId?.slice(0, 8) ?? "—"}
            </small>
            <button className="admin-note-delete" disabled={busy} onClick={() => removeNote(note.id)}>
              Удалить
            </button>
          </div>
        ))}
        {notes.length === 0 && <p className="settings-muted">Заметок пока нет.</p>}
      </div>
    </div>
  );
}
