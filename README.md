# Hex Token Cropper

A small Foundry VTT module for creating transparent hexagonal token images from existing artwork.

## Compatibility

- Foundry VTT 12+
- Verified for Foundry VTT 14
- GM-only, because saving files requires upload permission

## Installation

1. Extract the `hex-token-cropper` folder into Foundry's `Data/modules/` directory.
2. Restart Foundry.
3. Enable **Hex Token Cropper** under **Manage Modules** in the desired world.

## Use

Open the cropper from either location:

- The Token tools in the scene controls.
- **Configure Settings → Module Settings → Hex Token Cropper → Open Cropper**.

Then:

1. Choose an image using **Browse**.
2. Drag the hex over the desired part of the image.
3. Resize the hex with the width slider.
4. Choose PNG or WebP and an output size.
5. Click **Create Token**.

The image is saved beside the source file. By default, `portrait.png` becomes `portrait-token.png`.

## Notes

- The saved file is rectangular, as all raster image files are, but all pixels outside the hex are transparent.
- The default hex is flat-top.
- The crop is saved through Foundry's standard `FilePicker.upload` API.
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
