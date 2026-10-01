# Search across Projects

Type: grilling
Status: resolved
Blocked by:

## Question

How does search work?

- Where is the search box, and does it search all Projects or only the current Workspace?
- What is searched: Item text only, or Project names too? Crossed-out Items? The Change log?
- How are results shown, and what happens when you tap one (open the List view at that Item, unfold its branch)?
- Anything beyond plain text matching (e.g. filter "only open Tasks", "has due date")?

## Answer

Resolved with the user, 2026-10-01.

- **Scope:** searches **all Projects**. Matches in the current Workspace are listed first, the rest under "Other Projects".
- **What's matched:** Item text (Notes and Tasks), as plain case-insensitive matching. Project names are not matched in v1. The Change log is not searched.
- **Crossed-out matches are included**, after the open ones, dimmed and struck through.
- **One filter: "Has due date"** shows only dated Tasks, nearest first.
- **Tapping a result jumps to it in the List view**: the app opens the Project, unfolds the branch, scrolls to the Item and highlights it briefly. Each result shows the Item, its parent path, and the Project.
- Where the search box sits is left to the spec. *(Agent default: a search icon in the top bar, opening a full-screen search on the phone.)*
