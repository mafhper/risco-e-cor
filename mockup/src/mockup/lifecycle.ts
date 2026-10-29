// Artwork lifecycle (ciclo-vida-obra.md §2): where a piece lives and which
// destructive act is allowed. Trash is a separate list in the store, so the
// artwork keeps its own `visibility` and `publishedAt` while it waits there —
// restoring therefore returns it to the same place, never as a new piece.
//
//   draft      → only the author's gallery (not the mural)
//   published  → the family mural (and the gallery, with the star)
//   archived   → "Guardados": out of the mural and out of the main gallery
//   trash      → deleted list; adult-only, confirmed, restorable
//
// "Publicar" is a visibility flag (reversible, no file). "Exportar" is a file
// and lives only in the adult area — they never share a button.
import type { Artwork, Visibility } from "./store";

/** The verb the first destructive step uses. Never "apagar" on step one. */
export const DISCARD_LABEL = "Jogar fora";
export const UNDO_MS = 5000;

/** Kids may discard their own drafts — never a piece hanging on the mural. */
export function canChildDiscard(a: Artwork, authorId: string | null): boolean {
  return a.profileId === authorId && a.visibility === "draft";
}

/** The mural shows published pieces only; archived ones left it on purpose. */
export const showsOnMural = (a: Artwork): boolean => a.visibility === "published";

/** Gallery counts exclude the kept ones (the header says "N + K guardadas"). */
export const inMainGallery = (a: Artwork): boolean =>
  a.visibility === "draft" || a.visibility === "published";

export function archivePiece(a: Artwork): Artwork {
  return a.visibility === "archived" ? a : { ...a, visibility: "archived" };
}

/** Unarchiving never republishes on its own: the piece comes back as a draft. */
export function unarchivePiece(a: Artwork): Artwork {
  return a.visibility === "archived" ? { ...a, visibility: "draft" } : a;
}

/** A copy is always a draft: experimenting never moves the original. */
export function duplicatePiece(a: Artwork, id: string, now: number): Artwork {
  return {
    ...a,
    id,
    history: { commands: [...a.history.commands], redo: [], undoable: a.history.undoable },
    createdAt: now,
    updatedAt: now,
    visibility: "draft",
    publishedAt: null,
    ...(a.celebrated ? { celebrated: true } : {}),
  };
}

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  draft: "Rascunho",
  published: "No mural",
  archived: "Guardado",
};

/** Copy for the trash toast: says where it went, never asks for confirmation. */
export const TRASH_TOAST = "Foi para a lixeira";

/** Copy for the adult confirmation; irreversible acts always name the piece. */
export function purgeWarning(authorName: string | null): string {
  const owner = authorName ? ` de ${authorName}` : "";
  return `Apagar de vez o desenho${owner}? Não dá para desfazer.`;
}
