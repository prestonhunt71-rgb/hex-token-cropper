const MODULE_ID = "hex-token-cropper";

function getFilePickerClass() {
  // The Forge augments Foundry's global FilePicker with its Assets Library and
  // Bazaar sources. Using Foundry's namespaced base class on Forge bypasses
  // those additions, so the global class is intentionally required there.
  if (globalThis.ForgeVTT?.usingTheForge && globalThis.FilePicker) return globalThis.FilePicker;
  return globalThis.foundry?.applications?.apps?.FilePicker ?? globalThis.FilePicker;
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "suffix", {
    name: "Output filename suffix",
    hint: "Added immediately before the extension.",
    scope: "world",
    config: true,
    type: String,
    default: "-token"
  });

  game.settings.register(MODULE_ID, "outputFormat", {
    name: "Output format",
    hint: "PNG is lossless. WebP usually produces smaller files.",
    scope: "world",
    config: true,
    type: String,
    choices: { png: "PNG", webp: "WebP" },
    default: "png"
  });

  game.settings.registerMenu(MODULE_ID, "launchCropper", {
    name: "Open Hex Token Cropper",
    label: "Open Cropper",
    hint: "Choose an image, position the hex, and create a token.",
    icon: "fa-solid fa-crop-simple",
    type: HexTokenCropperLauncher,
    restricted: true
  });
});

Hooks.on("getSceneControlButtons", controls => {
  if (!game.user?.isGM) return;
  const tokenControls = controls.tokens ?? controls.find?.(c => c.name === "token");
  if (!tokenControls) return;

  const tool = {
    name: "hex-token-cropper",
    title: "Hex Token Cropper",
    icon: "fa-solid fa-hexagon-nodes",
    button: true,
    onChange: () => HexTokenCropper.open()
  };

  if (Array.isArray(tokenControls.tools)) tokenControls.tools.push(tool);
  else if (tokenControls.tools && typeof tokenControls.tools === "object") tokenControls.tools[tool.name] = tool;
});

class HexTokenCropperLauncher extends (foundry?.applications?.api?.ApplicationV2 ?? Application) {
  static DEFAULT_OPTIONS = {
    id: "hex-token-cropper-launcher",
    window: { title: "Hex Token Cropper" }
  };

  async render(_options = {}) {
    HexTokenCropper.open();
    return this;
  }
}

class HexTokenCropper {
  static open(initialPath = "", actor = null) {
    if (!game.user?.isGM) {
      ui.notifications.warn("Only a GM can create and upload token images.");
      return;
    }
    new HexTokenCropper(initialPath, actor).render();
  }

  constructor(initialPath = "", actor = null) {
    this.sourcePath = initialPath;
    this.storageSource = this.isForge() ? "forgevtt" : "data";
    this.actor = actor;
    this.image = null;
    this.display = null;
    this.hex = { x: 0, y: 0, width: 300, height: 260 };
    this.drag = null;
  }

  render() {
    if (!game.user?.isGM) {
      ui.notifications.warn("Hex Token Cropper is a Gamemaster-only tool.");
      return;
    }
    document.querySelector("#hex-token-cropper-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "hex-token-cropper-overlay";
    overlay.innerHTML = `
      <section class="htc-window" role="dialog" aria-modal="true" aria-label="Hex Token Cropper">
        <header class="htc-header">
          <h2><i class="fa-solid fa-crop-simple"></i> Hex Token Cropper</h2>
          <button type="button" class="htc-icon-button" data-action="close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </header>

        <div class="htc-source-row">
          <label>Source image</label>
          <div class="htc-path-controls">
            <input type="text" data-field="source" value="${this.escape(this.sourcePath)}" placeholder="Choose an image in Foundry storage">
            <button type="button" data-action="browse"><i class="fa-solid fa-folder-open"></i> Browse</button>
            <button type="button" data-action="load"><i class="fa-solid fa-image"></i> Load</button>
          </div>
        </div>

        <div class="htc-main">
          <div class="htc-stage-wrap">
            <canvas class="htc-stage" width="900" height="620"></canvas>
            <div class="htc-empty">Choose an image to begin.</div>
          </div>

          <aside class="htc-sidebar">
            <label>
              Drag action
              <select data-field="dragMode">
                <option value="hex" selected>Move hex</option>
                <option value="image">Move image</option>
              </select>
            </label>
            <label>
              Hex orientation
              <select data-field="orientation">
                <option value="flat" selected>Flat top</option>
                <option value="point">Point top</option>
              </select>
            </label>
            <label>
              Hex width
              <input type="range" data-field="hexWidth" min="80" max="800" step="2" value="300">
              <output data-output="hexWidth">300 px</output>
            </label>
            <label>
              Output size
              <select data-field="outputSize">
                <option value="natural">Natural crop size</option>
                <option value="256">256 px wide</option>
                <option value="512" selected>512 px wide</option>
                <option value="1024">1024 px wide</option>
              </select>
            </label>
            <label>
              Filename suffix
              <input type="text" data-field="suffix" value="${this.escape(game.settings.get(MODULE_ID, "suffix"))}">
            </label>
            <label>
              Format
              <select data-field="format">
                <option value="png" ${game.settings.get(MODULE_ID, "outputFormat") === "png" ? "selected" : ""}>PNG</option>
                <option value="webp" ${game.settings.get(MODULE_ID, "outputFormat") === "webp" ? "selected" : ""}>WebP</option>
              </select>
            </label>
            <label class="htc-checkbox">
              <input type="checkbox" data-field="outline">
              Bake a thin hex outline into image
            </label>
            <label class="htc-checkbox ${this.actor ? "" : "htc-hidden"}">
              <input type="checkbox" data-field="assignActor" ${this.actor ? "checked" : ""}>
              Assign to ${this.actor ? this.escape(this.actor.name) : "Actor"}
            </label>
            <p class="htc-help">Drag the hex to position it. Resize it with the slider. Everything outside the hex becomes transparent.</p>
          </aside>
        </div>

        <footer class="htc-footer">
          <span class="htc-status" data-status></span>
          <div>
            <button type="button" data-action="close">Cancel</button>
            <button type="button" class="htc-primary" data-action="create" disabled><i class="fa-solid fa-floppy-disk"></i> Create Token</button>
          </div>
        </footer>
      </section>`;

    document.body.appendChild(overlay);
    this.root = overlay;
    this.canvas = overlay.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.bindEvents();
    if (this.sourcePath) this.loadImage(this.sourcePath);
  }

  bindEvents() {
    this.root.addEventListener("click", event => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;
      if (action === "close") this.root.remove();
      if (action === "browse") this.browse();
      if (action === "load") this.loadImage(this.value("source"));
      if (action === "create") this.createToken();
    });

    this.root.querySelector('[data-field="hexWidth"]').addEventListener("input", event => {
      const oldCenter = { x: this.hex.x + this.hex.width / 2, y: this.hex.y + this.hex.height / 2 };
      this.hex.width = Number(event.target.value);
      this.hex.height = this.hexHeight(this.hex.width);
      this.hex.x = oldCenter.x - this.hex.width / 2;
      this.hex.y = oldCenter.y - this.hex.height / 2;
      this.clampHex();
      this.root.querySelector('[data-output="hexWidth"]').textContent = `${this.hex.width} px`;
      this.draw();
    });

    this.root.querySelector('[data-field="orientation"]').addEventListener("change", () => {
      const center = { x: this.hex.x + this.hex.width / 2, y: this.hex.y + this.hex.height / 2 };
      this.hex.height = this.hexHeight(this.hex.width);
      this.hex.x = center.x - this.hex.width / 2;
      this.hex.y = center.y - this.hex.height / 2;
      this.clampHex();
      this.draw();
    });

    this.canvas.addEventListener("pointerdown", event => {
      if (!this.image) return;
      const p = this.canvasPoint(event);
      const mode = this.value("dragMode");
      if (mode === "hex") {
        if (!this.pointInHex(p.x, p.y, this.hex)) return;
        this.drag = { mode, dx: p.x - this.hex.x, dy: p.y - this.hex.y };
      } else {
        if (!this.pointInDisplay(p.x, p.y)) return;
        this.drag = { mode, dx: p.x - this.display.x, dy: p.y - this.display.y };
      }
      this.canvas.setPointerCapture(event.pointerId);
    });

    this.canvas.addEventListener("pointermove", event => {
      if (!this.drag) return;
      const p = this.canvasPoint(event);
      if (this.drag.mode === "hex") {
        this.hex.x = p.x - this.drag.dx;
        this.hex.y = p.y - this.drag.dy;
        this.clampHex();
      } else {
        this.display.x = p.x - this.drag.dx;
        this.display.y = p.y - this.drag.dy;
        this.clampDisplayToHex();
      }
      this.draw();
    });

    const endDrag = () => { this.drag = null; };
    this.canvas.addEventListener("pointerup", endDrag);
    this.canvas.addEventListener("pointercancel", endDrag);
  }

  async browse() {
    const current = this.value("source");
    const FilePickerClass = getFilePickerClass();
    const picker = new FilePickerClass({
      type: "image",
      current,
      activeSource: this.storageSource,
      callback: path => {
        this.storageSource = picker.activeSource ?? this.storageSource;
        this.setValue("source", path);
        this.loadImage(path);
      }
    });
    return picker.browse();
  }

  async loadImage(path) {
    path = path?.trim();
    if (!path) return ui.notifications.warn("Choose an image first.");
    this.setStatus("Loading image…");

    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("The image could not be loaded. Check the file path and permissions."));
        image.src = path;
      });

      this.image = image;
      this.sourcePath = path;
      this.calculateDisplay();
      const defaultWidth = Math.min(360, this.display.width * 0.7);
      this.hex.width = Math.max(80, Math.round(defaultWidth));
      this.hex.height = this.hexHeight(this.hex.width);
      this.hex.x = this.display.x + (this.display.width - this.hex.width) / 2;
      this.hex.y = this.display.y + (this.display.height - this.hex.height) / 2;
      this.root.querySelector('[data-field="hexWidth"]').max = Math.round(Math.max(this.display.width, this.display.height));
      this.root.querySelector('[data-field="hexWidth"]').value = this.hex.width;
      this.root.querySelector('[data-output="hexWidth"]').textContent = `${this.hex.width} px`;
      this.root.querySelector(".htc-empty").classList.add("htc-hidden");
      this.root.querySelector('[data-action="create"]').disabled = false;
      this.setStatus(`${image.naturalWidth} × ${image.naturalHeight}`);
      this.draw();
    } catch (error) {
      console.error(`${MODULE_ID} | Failed loading image`, error);
      this.setStatus(error.message, true);
      ui.notifications.error(error.message);
    }
  }

  calculateDisplay() {
    const padding = 20;
    const scale = Math.min(
      (this.canvas.width - padding * 2) / this.image.naturalWidth,
      (this.canvas.height - padding * 2) / this.image.naturalHeight
    );
    const width = this.image.naturalWidth * scale;
    const height = this.image.naturalHeight * scale;
    this.display = {
      scale,
      width,
      height,
      x: (this.canvas.width - width) / 2,
      y: (this.canvas.height - height) / 2
    };
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1d1f22";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!this.image) return;

    ctx.drawImage(this.image, this.display.x, this.display.y, this.display.width, this.display.height);

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "destination-out";
    this.traceHex(ctx, this.hex);
    ctx.fill();
    ctx.restore();

    ctx.save();
    this.traceHex(ctx, this.hex);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.stroke();
    ctx.setLineDash([10, 7]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.stroke();
    ctx.restore();
  }

  async createToken() {
    if (!this.image || !this.display) return;
    const button = this.root.querySelector('[data-action="create"]');
    button.disabled = true;
    this.setStatus("Creating token…");

    try {
      const sourceRect = this.displayHexToSource();
      const requestedWidth = this.value("outputSize");
      const outputWidth = requestedWidth === "natural" ? Math.max(1, Math.round(sourceRect.width)) : Number(requestedWidth);
      const outputHeight = Math.max(1, Math.round(outputWidth * sourceRect.height / sourceRect.width));
      const output = document.createElement("canvas");
      output.width = outputWidth;
      output.height = outputHeight;
      const ctx = output.getContext("2d");

      const outHex = { x: 0, y: 0, width: outputWidth, height: outputHeight };
      ctx.save();
      this.traceHex(ctx, outHex);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        this.image,
        sourceRect.x,
        sourceRect.y,
        sourceRect.width,
        sourceRect.height,
        0,
        0,
        outputWidth,
        outputHeight
      );
      ctx.restore();

      if (this.checked("outline")) {
        ctx.save();
        this.traceHex(ctx, outHex);
        ctx.lineWidth = Math.max(2, outputWidth / 180);
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.stroke();
        ctx.restore();
      }

      const format = this.value("format");
      const mime = format === "webp" ? "image/webp" : "image/png";
      const blob = await new Promise(resolve => output.toBlob(resolve, mime, 0.95));
      if (!blob) throw new Error("The browser could not encode the token image.");

      const destination = await this.destinationPath(format);
      const file = new File([blob], destination.filename, { type: mime });
      const FilePickerClass = getFilePickerClass();
      const uploadResult = await FilePickerClass.upload(destination.source, destination.directory, file, {}, { notify: false });
      if (!uploadResult?.path) throw new Error("The storage provider did not return a saved file path.");
      const savedPath = uploadResult?.path ?? `${destination.directory}/${destination.filename}`.replace(/^\//, "");

      if (this.actor && this.checked("assignActor")) {
        await this.actor.update({ "prototypeToken.texture.src": savedPath });
      }

      this.setStatus(`Saved: ${savedPath}`);
      ui.notifications.info(`Hex token saved as ${savedPath}`);
    } catch (error) {
      console.error(`${MODULE_ID} | Token creation failed`, error);
      this.setStatus(error.message, true);
      ui.notifications.error(`Token creation failed: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  displayHexToSource() {
    const d = this.display;
    const x = (this.hex.x - d.x) / d.scale;
    const y = (this.hex.y - d.y) / d.scale;
    const width = this.hex.width / d.scale;
    const height = this.hex.height / d.scale;
    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(width, this.image.naturalWidth - Math.max(0, x)),
      height: Math.min(height, this.image.naturalHeight - Math.max(0, y))
    };
  }

  async destinationPath(format) {
    let cleanPath = this.safeDecode(this.sourcePath.split("?")[0]);
    let source = this.storageSource || "data";

    if (this.isForge()) {
      source = "forgevtt";
      const assetPrefix = await this.forgeAssetPrefix();
      if (assetPrefix && cleanPath.startsWith(assetPrefix)) {
        cleanPath = cleanPath.slice(assetPrefix.length);
      } else if (/^https?:\/\//i.test(cleanPath)) {
        // External and shared-library URLs cannot reliably be written beside the
        // source. Save them in a module-owned folder in the user's Assets Library.
        cleanPath = `hex-token-cropper/${cleanPath.split("/").pop() || "token.png"}`;
      }
    }

    cleanPath = cleanPath.replace(/^\/+/, "");
    const slash = cleanPath.lastIndexOf("/");
    const directory = slash >= 0 ? cleanPath.slice(0, slash) : "";
    const original = slash >= 0 ? cleanPath.slice(slash + 1) : cleanPath;
    const dot = original.lastIndexOf(".");
    const base = dot > 0 ? original.slice(0, dot) : original;
    const suffix = this.value("suffix") || "-token";
    return { source, directory, filename: `${base}${suffix}.${format}` };
  }

  isForge() {
    return Boolean(globalThis.ForgeVTT?.usingTheForge);
  }

  async forgeAssetPrefix() {
    try {
      if (!globalThis.ForgeVTT?.ASSETS_LIBRARY_URL_PREFIX || !globalThis.ForgeAPI?.getUserId) return "";
      const userId = await globalThis.ForgeAPI.getUserId();
      return `${globalThis.ForgeVTT.ASSETS_LIBRARY_URL_PREFIX}${userId}/`;
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not determine Forge Assets Library prefix`, error);
      return "";
    }
  }

  safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch (_error) {
      return value;
    }
  }

  hexHeight(width) {
    return this.value("orientation") === "flat" ? width * Math.sqrt(3) / 2 : width * 2 / Math.sqrt(3);
  }

  traceHex(ctx, rect) {
    const { x, y, width: w, height: h } = rect;
    ctx.beginPath?.();
    if (this.value("orientation") === "flat") {
      ctx.moveTo(x + w * 0.25, y);
      ctx.lineTo(x + w * 0.75, y);
      ctx.lineTo(x + w, y + h * 0.5);
      ctx.lineTo(x + w * 0.75, y + h);
      ctx.lineTo(x + w * 0.25, y + h);
      ctx.lineTo(x, y + h * 0.5);
    } else {
      ctx.moveTo(x + w * 0.5, y);
      ctx.lineTo(x + w, y + h * 0.25);
      ctx.lineTo(x + w, y + h * 0.75);
      ctx.lineTo(x + w * 0.5, y + h);
      ctx.lineTo(x, y + h * 0.75);
      ctx.lineTo(x, y + h * 0.25);
    }
    ctx.closePath();
  }

  pointInHex(px, py, rect) {
    const probe = new Path2D();
    this.traceHex(probe, rect);
    return this.ctx.isPointInPath(probe, px, py);
  }

  pointInDisplay(px, py) {
    const d = this.display;
    return px >= d.x && px <= d.x + d.width && py >= d.y && py <= d.y + d.height;
  }

  clampHex() {
    if (!this.display) return;
    this.hex.x = Math.max(this.display.x, Math.min(this.hex.x, this.display.x + this.display.width - this.hex.width));
    this.hex.y = Math.max(this.display.y, Math.min(this.hex.y, this.display.y + this.display.height - this.hex.height));
  }

  clampDisplayToHex() {
    if (!this.display) return;
    this.display.x = Math.min(this.hex.x, Math.max(this.display.x, this.hex.x + this.hex.width - this.display.width));
    this.display.y = Math.min(this.hex.y, Math.max(this.display.y, this.hex.y + this.hex.height - this.display.height));
  }

  canvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * this.canvas.width / rect.width,
      y: (event.clientY - rect.top) * this.canvas.height / rect.height
    };
  }

  value(name) {
    return this.root.querySelector(`[data-field="${name}"]`)?.value;
  }

  setValue(name, value) {
    const field = this.root.querySelector(`[data-field="${name}"]`);
    if (field) field.value = value;
  }

  checked(name) {
    return Boolean(this.root.querySelector(`[data-field="${name}"]`)?.checked);
  }

  setStatus(message, error = false) {
    const status = this.root.querySelector("[data-status]");
    status.textContent = message ?? "";
    status.classList.toggle("htc-error", error);
  }

  escape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}

// Console/API access for macros and future integrations.
globalThis.HexTokenCropper = HexTokenCropper;
