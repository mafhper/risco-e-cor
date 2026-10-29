<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- The app is a clickable phone mockup: all screens live in `src/mockup/` and are switched by an in-memory screen state (not routes), so the phone frame stays one page. Why: it mirrors a single-activity Android app.
- Artwork is a command list (`src/mockup/history.ts`); undo/redo, autosave and previews all derive from it. Why: same model planned for the native app.
