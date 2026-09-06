# Token Shape Cropper

A small Foundry VTT module for creating hexagonal, circular, or square token images from existing artwork.

## Compatibility

- Foundry VTT 12+
- Verified for Foundry VTT 14
- GM-only, because saving files requires upload permission
- The Forge Assets Library (explicit `forgevtt` upload support)

Version 1.3.0 adds circle and square crops plus one-click copying of a newly saved token's path. It uses The Forge's augmented FilePicker while hosted on Forge, preserving the **The Forge Assets** and **The Bazaar** tabs. Outside Forge it uses Foundry's namespaced FilePicker API.

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
5. Choose PNG or WebP and an output size.
6. Click **Create Token**.
7. Click **Copy Path** to put the saved token path on the clipboard for pasting elsewhere.

The image is saved beside the source file. By default, `portrait.png` becomes `portrait-token.png`.

## Notes

- The saved file is rectangular, as all raster image files are, but pixels outside a hex or circle are transparent.
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
