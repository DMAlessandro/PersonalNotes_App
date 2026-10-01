# PersonalNote

A personal notes-and-tasks app for one person across a laptop and a phone, organised like a messaging app and viewable as a tree map.

## Structure

**Project**:
A top-level thread of related Items, the equivalent of one conversation in a messaging app. Its deadline is the earliest due date among its open Tasks; its position in the list never changes when something is ticked.
_Avoid_: Conversation, chat, major note, topic

**Item**:
A single entry in a Project's outline: either a Note or a Task. Only Tasks have children (Tasks or Notes), to any depth. Open Items with a due date are shown first, nearest on top; the rest keep the user's order.
_Avoid_: Message, sub-note, post

**Note**:
An Item of plain text (links clickable) with no tick box, always placed under a Task, never with children of its own. A Note can be turned into a Task, but a Task cannot be turned back.

**Task**:
An Item with a tick box and an optional due date.
_Avoid_: Todo, checklist item

**Subtask**:
A Task whose parent is another Task.
_Avoid_: Undertask

**Workspace**:
A named selection of Projects that filters what the app shows. One Project can belong to several Workspaces.
_Avoid_: Board, group, folder

**All Projects**:
The built-in Workspace that always contains every Project and is shown when the app opens.

## Lifecycle

**Crossed out**:
The single "finished / no longer active" state of an Item or a Project, shown with a line through it. You reach it by ticking a Task, or by choosing "Cross out" on a Note. Crossing out an Item crosses out and folds its whole branch. It never moves the Item. It can always be undone.
_Avoid_: Checked, done, struck, discarded, archived

**Delete**:
The deliberate, separate removal of a crossed-out Item and its branch, done from the Item's menu. Only crossed-out Items can be Deleted. It can be undone through the Change log.
_Avoid_: Remove, purge

**Change log**:
The record of every Cross-out and Delete, kept week by week. Each entry keeps the full content and date, so the Item can be restored.
_Avoid_: History, trash, bin

## Views

**List view**:
The outline of one Project's Items in the order you give them, shown like a chat thread.
_Avoid_: Task list, thread view

**Map view**:
An automatically laid-out tree of one Workspace (Projects → their Item trees): drawn left to right by default on every device, with branches you can expand and collapse. Editing in the Map view changes the same Items shown in the List view.
_Avoid_: Mind map, canvas

## Sync

**Save**:
Automatic storing of every edit on the device itself. Needs no network and no user action.

**Push**:
The user's manual action that sends all Unpushed changes from the device to the GitHub repo.
_Avoid_: Save to GitHub, sync, upload, commit

**Unpushed changes**:
Edits that are Saved on a device but not yet Pushed. Folding a branch is Pushed too, but isn't counted as one.

**Readable copy**:
The formatted Markdown page of each Project that every Push writes to the repo, for reading on github.com. It is never edited by hand.
