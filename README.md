# Token Shape Cropper

A small Foundry VTT module for creating hexagonal, circular, or square token images from existing artwork.

## Compatibility

- Foundry VTT 12+
- Verified for Foundry VTT 14
- GM-only, because saving files requires upload permission
- The Forge Assets Library (explicit `forgevtt` upload support)

Version 1.4.1 saves all output as WebP. If the chosen character image is not already WebP, the module creates a WebP copy capped at 768 pixels on its longest side while preserving the original aspect ratio and original file. Smaller images are never enlarged. It also shows separate, copyable paths for the WebP character art and WebP token art. It uses The Forge's augmented FilePicker while hosted on Forge, preserving the **The Forge Assets** and **The Bazaar** tabs. Outside Forge it uses Foundry's namespaced FilePicker API.

## Installation

1. Extract the `hex-token-cropper` folder into Foundry's `Data/modules/` directory.
2. Restart Foundry.
3. Enable **Token Shape Cropper** under **Manage Modules** in the desired world.

## Use

Open the cropper from either location:

- The Token tools in the scene controls.
- **Configure Settings → Module Settings → Token Shape Cropper → Open Cropper**.

Then:

1. Choose an image using **Browse**.
2. Choose a hexagon, circle, or square.
3. Choose **Move shape** or **Move image**, then drag to position the crop.
4. Resize the shape with the size slider.
5. Choose an output size. Tokens are always saved as WebP.
6. Click **Create Token**.
7. Copy the separately labeled **Character Art** or **Token Art** path for use elsewhere.

The WebP files are saved beside the source when its storage location is writable. By default, `portrait.png` produces `portrait.webp` and `portrait-token.webp`; the original `portrait.png` remains untouched.

## Notes

- The saved file is rectangular, as all raster image files are, but pixels outside a hex or circle are transparent.
- Non-WebP source art is preserved and a WebP copy no larger than 768 pixels on its longest side is saved beside it when possible.
- Character-art conversion preserves aspect ratio and never enlarges smaller originals.
- Existing WebP character art is reused rather than converted again.
- The default hex is flat-top.
- The crop is saved through Foundry's standard `FilePicker.upload` API.
- On The Forge, output is uploaded explicitly to the user's Assets Library. If the source is in the user's own Assets Library, the token is saved beside it. For an external URL or a shared/read-only library, the token is saved in `hex-token-cropper/` in the user's own Assets Library.
- Images should be stored in Foundry-accessible storage. Remote images may fail because browsers prevent canvas export when cross-origin permissions are absent.

## Macro/API use

The module exposes a global helper:

```js
HexTokenCropper.open("path/to/image.png");
```

An Actor may also be supplied by another module or macro:

```js
HexTokenCropper.open(actor.img, actor);
```

When an Actor is supplied, the interface can assign the saved image to that Actor's prototype token.
