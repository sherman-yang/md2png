#!/usr/bin/env node
/**
 * md2png.mjs — Full ES Module version (JavaScript)
 * Version: 1.0
 * 
 * Copyright (c) 2025 Sherman
 * Author: Sherman <Sherman.shank@gmail.com>
 * 
 * Markdown → HTML → PNG with Playwright.
 * Features: custom CSS, default CSS support, tiled watermark (SVG base64, safe for CJK),
 * jittered characters, custom font, single-spot watermark fallback.
 *
 * Run with Node 18+ directly:
 *  node md2png.mjs -i README.md -o out.png \
 *    --wm-text "CONFIDENTIAL - DO NOT SHARE" --wm-tile --wm-opacity 0.25 \
 *    --wm-rotate -30 --wm-gap-x 180 --wm-gap-y 150 --wm-size 24
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { chromium } from "playwright";
import MarkdownIt from "markdown-it";
import { Command } from "commander";

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------- CLI ----------------
const program = new Command();
program
  .name("md2png")
  .description("Render Markdown to PNG via Playwright with optional watermark")
  .option("-i, --input <file>", "Markdown input file; if omitted, read from stdin")
  .option("-o, --output <file>", "Output PNG file (default: same as input with .png extension)")
  .option("--css <file>", "Attach custom CSS file (default: use built-in default.css)")
  .option("--no-default-css", "Disable default CSS (only when you want pure HTML rendering)")
  .option("--width <px>", "Viewport width (affects layout)", "1000")
  .option("--margin <px>", "Horizontal page margin inside .main", "48")
  // watermark options
  .option("--wm-text <text>", "Watermark text (omit to disable)")
  .option("--wm-tile", "Enable tiled watermark (default: true)")
  .option("--no-wm-tile", "Disable tiled watermark (use single corner watermark)")
  .option("--wm-opacity <n>", "Watermark opacity (0..1)", "0.25")
  .option("--wm-color <hex>", "Watermark color", "#334155")
  .option("--wm-rotate <deg>", "Watermark angle (deg)", "-30")
  .option("--wm-gap-x <px>", "Tile width (density X)", "180")
  .option("--wm-gap-y <px>", "Tile height (density Y)", "150")
  .option("--wm-size <px>", "Watermark font size", "24")
  .option("--wm-font <css>", "Watermark font-family", "Arial, sans-serif")
  .option("--wm-random-jitter", "Apply random per-character jitter (dx/dy)")
  .option("--verbose", "Print progress logs")
  .parse(process.argv);
const opts = program.opts();

// ---------------- Helpers ----------------
function log() { if (opts.verbose) console.log("[md2png]", ...arguments); }

function assertNumber(val, name) {
  const n = Number(val);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
}

function escapeHtml(s = "") {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function svgBase64(svg) {
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

function buildTiledWatermarkSVG(params) {
  const { text, tileW, tileH, color, opacity, rotate, font, size, jitter } = params;
  const cx = Math.floor(tileW / 2);
  const cy = Math.floor(tileH / 2);

  let textNode;
  if (jitter) {
    const chars = [...text];
    textNode = `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'>` +
      chars.map(ch => {
        const dx = Math.floor(Math.random() * 7) - 3;
        const dy = Math.floor(Math.random() * 5) - 2;
        return `<tspan dx='${dx}' dy='${dy}'>${escapeHtml(ch)}</tspan>`;
      }).join("") + `</text>`;
  } else {
    textNode = `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'>${escapeHtml(text)}</text>`;
  }

  // Use # directly instead of %23
  return `<?xml version="1.0"?>
<svg xmlns='http://www.w3.org/2000/svg' width='${tileW}' height='${tileH}'>
  <defs>
    <filter id='wobble' x='-20%' y='-20%' width='140%' height='140%'>
      <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='1' seed='7' result='n'/>
      <feDisplacementMap in='SourceGraphic' in2='n' scale='1.2'/>
    </filter>
  </defs>
  <g filter='url(#wobble)' fill='${color}' opacity='${opacity}'
     font-family='${font}' font-size='${size}'
     transform='rotate(${rotate} ${cx} ${cy})'>
    ${textNode}
  </g>
</svg>`;
}

function buildWatermarkCSS() {
  const text = (opts.wmText ?? "").toString();
  if (!text) return "";

  const opacity = Number(opts.wmOpacity);
  const color = (opts.wmColor ?? "#334155").toString();
  const rotate = Number(opts.wmRotate);
  const size = Number(opts.wmSize);
  const font = (opts.wmFont ?? "Arial, sans-serif").toString();

  // Default wmTile to true if not explicitly set
  const useTile = opts.wmTile ?? true;

  if (useTile) {
    const tileW = assertNumber(opts.wmGapX, "--wm-gap-x");
    const tileH = assertNumber(opts.wmGapY, "--wm-gap-y");
    const svg = buildTiledWatermarkSVG({
      text,
      tileW,
      tileH,
      color,
      opacity,
      rotate,
      font,
      size,
      jitter: Boolean(opts.wmRandomJitter),
    });
    const dataUri = svgBase64(svg);
    // Use absolute positioning to cover entire document height
    return `body::before{
      content:"";
      position:absolute;
      top:0;
      left:0;
      width:100%;
      height:100%;
      min-height:100vh;
      pointer-events:none;
      z-index:999999 !important;
      background-image:url('${dataUri}');
      background-repeat:repeat;
      background-size:${tileW}px ${tileH}px;
      background-position:0 0;
    }
    body{
      position:relative;
      min-height:100vh;
    }`;
  }

  // Single watermark also uses absolute positioning
  return `body::before{
    content:"${escapeHtml(text)}";
    position:absolute;
    right:20px;
    bottom:20px;
    font-size:${size}px;
    color:${color};
    opacity:${opacity};
    font-family:${font};
    transform:rotate(${rotate}deg);
    pointer-events:none;
    z-index:999999 !important;
    white-space:nowrap;
  }
  body{
    position:relative;
  }`;
}

// ---------------- Main ----------------
(async () => {
  const width = assertNumber(opts.width, "--width");
  const margin = assertNumber(opts.margin, "--margin");

  let mdSource = "";
  if (opts.input) {
    log("read file:", opts.input);
    mdSource = fs.readFileSync(opts.input, "utf8");
  } else {
    if (process.stdin.isTTY) {
      console.error("No input provided. Use -i <file> or pipe markdown via stdin.");
      process.exit(2);
    }
    log("read stdin...");
    mdSource = await new Promise(resolve => {
      let buf = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", c => buf += c);
      process.stdin.on("end", () => resolve(buf));
    });
  }

  const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
  const mdHtml = md.render(mdSource);

  let userCSS = "";
  
  // Handle CSS: user specified > default.css > no styles
  if (opts.css) {
    // User explicitly specified CSS file
    log("attach custom css:", opts.css);
    userCSS = fs.readFileSync(opts.css, "utf8");
  } else if (opts.defaultCss !== false) {
    // No CSS specified and default CSS not disabled, try loading default.css
    const defaultCssPath = path.join(__dirname, "default.css");
    if (fs.existsSync(defaultCssPath)) {
      log("attach default css:", defaultCssPath);
      userCSS = fs.readFileSync(defaultCssPath, "utf8");
    } else {
      log("default.css not found, using minimal styles only");
    }
  } else {
    log("default css disabled");
  }
  
  const wmCSS = buildWatermarkCSS();

  // Adjust CSS order to ensure watermark CSS loads last
  const pageCSS = `
    :root{ --bg:#ffffff; --fg:#111; }
    html,body{ margin:0; padding:0; }
    body{ color:var(--fg); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",Arial,sans-serif; line-height:1.65; }
    .main{ width:${Math.max(320, width - margin*2)}px; margin:${margin}px auto; }
  `;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>${pageCSS}</style>
<style>${userCSS}</style>
<style>${wmCSS}</style>
</head>
<body><main class="main">${mdHtml}</main></body></html>`;

  const tmpHtml = path.join(process.cwd(), `.md2png.${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, html, "utf8");
  log("tmp html:", tmpHtml);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  // Increase wait time to ensure all resources are loaded
  await page.waitForTimeout(800);
  
  // Determine output path: use specified output or derive from input
  let outPath = opts.output;
  if (!outPath && opts.input) {
    const parsed = path.parse(opts.input);
    outPath = path.join(parsed.dir, parsed.name + ".png");
  } else if (!outPath) {
    outPath = "out.png";
  }
  
  await page.screenshot({ path: outPath, fullPage: true, omitBackground: false });
  await browser.close();

  try { fs.unlinkSync(tmpHtml); } catch {}
  console.log(`✅ PNG generated: ${outPath}`);
  
  if (opts.wmText) {
    log("Watermark applied:", opts.wmText);
  }
})().catch(err => {
  console.error("[ERROR]", err?.stack || err);
  process.exit(1);
});