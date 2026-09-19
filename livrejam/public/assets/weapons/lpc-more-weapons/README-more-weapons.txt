[LPC] More weapons by bluecarrot16
License: OGA-BY 3.0+

https://opengameart.org/content/lpc-more-weapons



## Usage

All items use existing animation frames and hence are compatible with all existing clothing items. However to assemble the completed spritesheet, some frames will need to be used in different ways, duplicated, and/or played in a different order, as described below. 


For each weapon, use them like this:

	1. Assemble your complete spritesheet as usual by layering all other items (e.g. base, clothing, hair, accessories, etc.). This is your 'character spritesheet'.
	2. Re-assemble each frame from the slash animation of your character spritesheet into an "oversize" 192x192px frame, such that each original 64x64px sprite is centered within the larger frame. This is your 'oversized character spritesheet'.
	3. Re-arrange frames from the oversized character spritesheet in the following order (left-to-right): 
		- `slash`: (no change)
		- `thrust`: (no change)
		- `slash_reverse` (use frames from `slash` animation): 5, 4, 3, 2, 1, 0
		- `whip` (use frames from `slash` animation):
			- n: 0, 1, 4, 5, 3, 2, 2, 1
			- w: 0, 1, 5, 4, 3, 3, 3, 2
			- s: 0, 1, 5, 4, 3, 3, 2, 1
			- e: 0, 1, 5, 4, 3, 3, 3, 2
	4. Layer the following sheets, back-to-front: {weapon}-bg.png, {your oversized character sheet with re-arranged animations}, {weapon}-fg.png. 

The [Universal LPC Spritesheet Character Generator](https://sanderfrenken.github.io/Universal-LPC-Spritesheet-Character-Generator) can also do these transformations for you and will be updated with these weapons shortly.

Walk animations, when available, are in the `universal/` subdirectory. Not all weapons have walk animations; sorry...

Custom animations in JSON format:

```json
{
  "slash_reverse_oversize": {
    "frameSize": 192,
    "frames": [
      ["slash-n,5", "slash-n,4", "slash-n,3", "slash-n,2", "slash-n,1", "slash-n,0"],
      ["slash-w,5", "slash-w,4", "slash-w,3", "slash-w,2", "slash-w,1", "slash-w,0"],
      ["slash-s,5", "slash-s,4", "slash-s,3", "slash-s,2", "slash-s,1", "slash-s,0"],
      ["slash-e,5", "slash-e,4", "slash-e,3", "slash-e,2", "slash-e,1", "slash-e,0"]
    ]
  },

  "whip_oversize": {
    "frameSize": 192,
    "frames": [
      ["slash-n,0", "slash-n,1", "slash-n,4", "slash-n,5", "slash-n,3", "slash-n,2", "slash-n,2", "slash-n,1"],
      ["slash-w,0", "slash-w,1", "slash-w,5", "slash-w,4", "slash-w,3", "slash-w,3", "slash-w,3", "slash-w,2"],
      ["slash-s,0", "slash-s,1", "slash-s,5", "slash-s,4", "slash-s,3", "slash-s,3", "slash-s,2", "slash-w,1"],
      ["slash-e,0", "slash-e,1", "slash-e,5", "slash-e,4", "slash-e,3", "slash-e,3", "slash-e,3", "slash-e,2"]
    ]
  }
}
```