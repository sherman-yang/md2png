# md2png Global Installation Guide

## Method 1: npm Global Install (Recommended)

### 1. Installation Steps

Execute in your project directory:

```bash
# Install dependencies
npm install

# Global install (will auto-link)
npm install -g .
```

Or use npm link:

```bash
# Install dependencies
npm install

# Create global link
npm link
```

### 2. File Structure

Ensure your project directory structure is as follows:

```
md2png/
├── md2png.mjs          # Main script
├── default.css         # Default stylesheet
├── package.json        # Package configuration
└── README.md
```

### 3. Verify Installation

```bash
# Check if installed successfully
which md2png

# View help
md2png --help
```

### 4. Usage Examples

After installation, can be used in any directory:

```bash
# Using default CSS and watermark
md2png -i document.md -o output.png \
  --wm-text "CONFIDENTIAL"

# Using custom CSS
md2png -i document.md -o output.png \
  --css ./custom.css --wm-text "CONFIDENTIAL"

# Disable default CSS
md2png -i document.md -o output.png --no-default-css

# Auto-generate output filename (same as input, with .png extension)
md2png -i document.md --wm-text "INTERNAL USE ONLY"
```

## Method 2: Manual Global Install

### 1. Copy Files to Global Location

```bash
# Create global directory
sudo mkdir -p /usr/local/lib/md2png

# Copy all files
sudo cp md2png.mjs /usr/local/lib/md2png/
sudo cp default.css /usr/local/lib/md2png/
sudo cp package.json /usr/local/lib/md2png/

# Install dependencies
cd /usr/local/lib/md2png
sudo npm install --production
```

### 2. Create Executable Link

```bash
# Add execute permission
sudo chmod +x /usr/local/lib/md2png/md2png.mjs

# Create symlink
sudo ln -s /usr/local/lib/md2png/md2png.mjs /usr/local/bin/md2png
```

### 3. Verify Installation

```bash
md2png --help
```

## Method 3: Using alias (Temporary Solution)

If you don't want to install globally, add to `~/.bashrc` or `~/.zshrc`:

```bash
alias md2png='node /path/to/your/md2png/md2png.mjs'
```

Then:

```bash
source ~/.bashrc  # or source ~/.zshrc
```

## Default CSS Working Principle

1. **Auto-search**: Script automatically searches for `default.css` in its directory
2. **Priority**:
   - If CSS file specified with `--css`, use specified CSS
   - If not specified, automatically use `default.css` (if exists)
   - If using `--no-default-css`, don't load any default styles

3. **Customize default styles**:
   - Directly edit `default.css` in installation directory
   - Or create multiple CSS files, specify with `--css`

## Default Settings

- **Output file**: If not specified, uses same name as input file with `.png` extension
- **Watermark tiling**: Enabled by default (`--wm-tile`)
- **Watermark opacity**: 0.25 by default
- **Watermark rotation**: -30 degrees by default
- **Watermark tile width**: 180px by default
- **Watermark tile height**: 150px by default

## Uninstall

### Uninstall npm installation:

```bash
npm uninstall -g md2png
# or
npm unlink
```

### Uninstall manual installation:

```bash
sudo rm /usr/local/bin/md2png
sudo rm -rf /usr/local/lib/md2png
```

## Common Issues

### Q: Can't find default.css?

A: Ensure `default.css` and `md2png.mjs` are in the same directory. Use `--verbose` parameter to view loaded CSS path.

### Q: Permission error?

A: Use `sudo npm install -g .` or ensure write permission to `/usr/local/`.

### Q: Windows users?

A: Using npm global install is simplest:
```bash
npm install -g .
```

Windows will automatically handle path and permission issues.