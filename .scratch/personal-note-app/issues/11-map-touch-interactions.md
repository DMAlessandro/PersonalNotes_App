# Map view touch interactions on a phone

Type: prototype
Status: claimed
Blocked by:

## Question

How should the Map view feel with fingers on an Android phone?

Extend the Map view prototype ([prototypes/map-view-prototype.html](../prototypes/map-view-prototype.html)) and try it on the phone:

- Pinch to zoom, one-finger drag to pan.
- Opening an Item's menu: tap ⋯, or long-press the box.
- Editing text directly on a box vs a bottom panel.
- Tap targets big enough for the tick box and fold arrow at the minimum readable zoom.

## Comments

2026-10-02, the user tried it on the phone. Published prototype: https://claude.ai/artifact/UyzqA6yMsit4Hq4iyv3MHp (source: [prototypes/map-touch-prototype.html](../prototypes/map-touch-prototype.html)).

- **Editing on the box works well on the phone** (preferred over the bottom panel).
- **Every box shows its full text, wrapped between whole words, never cut off**, on every device, whether editing or just viewing. Boxes grow taller to fit, and the layout makes room for each box's real height. Version 2 of the prototype does this, and the edit field wraps too.
- Waiting for the user to check version 2 before resolving.
- 2026-10-02, version 3. The user clarified that the problem was mainly the **width** of boxes, on laptop and phone: words were split because the text column was too narrow. Now each box **shrink-wraps its text up to about 210px**, so lines wrap only between whole words and the box is as wide as its longest line. A single word that doesn't fit makes the box wider instead of being split. Due date and progress sit on a second line under the text. Columns (left → right) are as wide as their widest box. Checked with headless Edge screenshots at laptop and phone sizes.
