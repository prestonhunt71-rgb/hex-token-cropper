import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../scripts/hex-token-cropper.js", import.meta.url), "utf8");

function loadCropper(FilePickerClass = class {}) {
  const context = {
    Application: class {},
    FilePicker: FilePickerClass,
    Hooks: { once() {}, on() {} },
    Path2D: class {},
    console,
    foundry: {
      applications: {
        api: { ApplicationV2: class {} },
        apps: { FilePicker: FilePickerClass }
      }
    },
    game: { settings: { register() {}, registerMenu() {} }, user: { isGM: true } },
    ui: { notifications: { error() {}, info() {}, warn() {} } }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { Cropper: context.HexTokenCropper, context };
}

function instance(Cropper, path, suffix = "-token") {
  const cropper = Object.create(Cropper.prototype);
  cropper.sourcePath = path;
  cropper.storageSource = "data";
  cropper.value = name => name === "suffix" ? suffix : undefined;
  cropper.isForge = () => false;
  return cropper;
}

test("recognizes WebP paths regardless of case or URL suffix", () => {
  const { Cropper } = loadCropper();
  const cropper = instance(Cropper, "portrait.png");
  assert.equal(cropper.isWebPPath("portraits/Hero.WEBP?cache=1"), true);
  assert.equal(cropper.isWebPPath("portraits/Hero.png"), false);
});

test("builds WebP character and token destinations beside local source art", async () => {
  const { Cropper } = loadCropper();
  const cropper = instance(Cropper, "portraits/Hero.png");
  assert.deepEqual(
    JSON.parse(JSON.stringify(await cropper.destinationPath(""))),
    { source: "data", directory: "portraits", filename: "Hero.webp" }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(await cropper.destinationPath())),
    { source: "data", directory: "portraits", filename: "Hero-token.webp" }
  );
});

test("uses the Forge Assets Library for converted external art", async () => {
  const { Cropper } = loadCropper();
  const cropper = instance(Cropper, "https://example.com/portraits/Hero.jpg");
  cropper.isForge = () => true;
  cropper.forgeAssetPrefix = async () => "https://assets.forge-vtt.com/user-id/";
  assert.deepEqual(
    JSON.parse(JSON.stringify(await cropper.destinationPath(""))),
    { source: "forgevtt", directory: "hex-token-cropper", filename: "Hero.webp" }
  );
});

test("reuses existing WebP character art without uploading a copy", async () => {
  let uploads = 0;
  class FilePickerClass {
    static async upload() { uploads += 1; }
  }
  const { Cropper } = loadCropper(FilePickerClass);
  const cropper = instance(Cropper, "portraits/Hero.webp");
  assert.equal(await cropper.ensureCharacterArtWebP(), "portraits/Hero.webp");
  assert.equal(uploads, 0);
});

test("encodes canvases as WebP at the configured quality", async () => {
  const { Cropper } = loadCropper();
  const cropper = instance(Cropper, "portrait.png");
  const expected = { type: "image/webp" };
  const canvas = {
    toBlob(callback, type, quality) {
      assert.equal(type, "image/webp");
      assert.equal(quality, 0.95);
      callback(expected);
    }
  };
  assert.equal(await cropper.canvasToWebP(canvas), expected);
});

test("scales converted portrait art to a 768 px longest edge", () => {
  const { Cropper } = loadCropper();
  const cropper = instance(Cropper, "portrait.png");
  assert.deepEqual(
    JSON.parse(JSON.stringify(cropper.scaledCharacterDimensions(1024, 1536))),
    { width: 512, height: 768 }
  );
});

test("scales converted landscape art while preserving aspect ratio", () => {
  const { Cropper } = loadCropper();
  const cropper = instance(Cropper, "landscape.jpg");
  assert.deepEqual(
    JSON.parse(JSON.stringify(cropper.scaledCharacterDimensions(1920, 1080))),
    { width: 768, height: 432 }
  );
});

test("does not enlarge smaller character art", () => {
  const { Cropper } = loadCropper();
  const cropper = instance(Cropper, "small.png");
  assert.deepEqual(
    JSON.parse(JSON.stringify(cropper.scaledCharacterDimensions(400, 600))),
    { width: 400, height: 600 }
  );
});

test("rejects a browser fallback that is not actually WebP", async () => {
  const { Cropper } = loadCropper();
  const cropper = instance(Cropper, "portrait.png");
  const canvas = { toBlob(callback) { callback({ type: "image/png" }); } };
  await assert.rejects(cropper.canvasToWebP(canvas), /could not encode WebP/);
});
