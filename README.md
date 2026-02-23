# FBX to VRMA Converter v2.1

Convert FBX animation files to VRMA (VRM Animation) format.
Compatible with VRoid Hub, @pixiv/three-vrm-animation, and other VRM 1.0 tools.

English README | [日本語 README](README-jp.md)

## Features

- **FBX to VRMA conversion** — Converts Mixamo FBX animations to VRMA format
- **GLB binary output** — Outputs standard GLB binary format, compatible with VRoid Hub
- **52-bone support** — Full humanoid mapping including all finger bones (30 bones)
- **VRMA spec compliant** — Filters illegal scale/translation channels per VRMC_vrm_animation 1.0
- **Batch conversion** — Convert an entire directory of FBX files at once
- **Cross-platform** — macOS, Windows, Linux; binary path auto-detected by OS

## Requirements

- Node.js 18+
- FBX2glTF binary (downloaded automatically by setup script)
- macOS (Apple Silicon requires Rosetta 2), Windows, or Linux

## Installation

```bash
git clone https://github.com/TK-256/fbx2vrma-converter.git
cd fbx2vrma-converter
npm install
```

`npm install` automatically downloads the FBX2glTF binary via the setup script.
If the download fails, run it manually:

```bash
# macOS / Linux
./setup.sh

# Windows
setup.bat
```

### Apple Silicon (M1/M2/M3)

The FBX2glTF binary is x64-only. Install Rosetta 2 to run it:

```bash
softwareupdate --install-rosetta --agree-to-license
```

### Manual binary download

If the script fails, download the binary from the [FBX2glTF releases page](https://github.com/facebookincubator/FBX2glTF/releases/tag/v0.9.7) and place it in the project directory:

| Platform | Binary filename |
|---|---|
| macOS | `FBX2glTF-darwin-x64` |
| Windows | `FBX2glTF-windows-x64.exe` |
| Linux | `FBX2glTF-linux-x64` |

## Usage

### Single file

`-o` is optional. If omitted, the output is saved in the same directory as the input with the same filename and a `.vrma` extension.

```bash
# Output saved as input.vrma in the same directory
node fbx2vrma-converter.js -i input.fbx

# Output saved as input.vrma in the specified directory
node fbx2vrma-converter.js -i input.fbx -o ./output/

# Output saved with an explicit filename
node fbx2vrma-converter.js -i input.fbx -o ./output/animation.vrma
```

### Batch conversion

Specify a directory for `-i` to convert all FBX files at once. `-o` defaults to the input directory if omitted.

```bash
node fbx2vrma-converter.js -i ./FBX/ -o ./VRMA/
```

Output filenames are derived from the input filenames (`Walk.fbx` → `Walk.vrma`).

### Options

| Option | Description | Default |
|---|---|---|
| `-i, --input <path>` | Input FBX file or directory (required) | — |
| `-o, --output <path>` | Output VRMA file or directory | Same directory as input |
| `--fbx2gltf <path>` | Path to FBX2glTF binary | Auto-detected by OS |
| `--framerate <fps>` | Animation framerate | `30` |
| `-V, --version` | Show version | — |
| `-h, --help` | Show help | — |

## How it works

1. Convert FBX → glTF using FBX2glTF
2. Analyze animation timing (duration, frame count)
3. Embed binary buffer as base64
4. Filter channels that violate VRMA spec (scale on humanoid bones, translation on non-hips bones)
5. Map Mixamo bone names to VRM humanoid bone names
6. Strip mesh/skin references and rest-pose scale from nodes
7. Output as GLB binary

## Bone mapping

The converter maps 52 Mixamo bones to the VRM 1.0 humanoid specification.

**Body (22 bones)**

| Mixamo | VRM |
|---|---|
| `mixamorig:Hips` | `hips` |
| `mixamorig:Spine` | `spine` |
| `mixamorig:Spine1` | `chest` |
| `mixamorig:Spine2` | `upperChest` |
| `mixamorig:Neck` | `neck` |
| `mixamorig:Head` | `head` |
| `mixamorig:LeftShoulder` / `RightShoulder` | `leftShoulder` / `rightShoulder` |
| `mixamorig:LeftArm` / `RightArm` | `leftUpperArm` / `rightUpperArm` |
| `mixamorig:LeftForeArm` / `RightForeArm` | `leftLowerArm` / `rightLowerArm` |
| `mixamorig:LeftHand` / `RightHand` | `leftHand` / `rightHand` |
| `mixamorig:LeftUpLeg` / `RightUpLeg` | `leftUpperLeg` / `rightUpperLeg` |
| `mixamorig:LeftLeg` / `RightLeg` | `leftLowerLeg` / `rightLowerLeg` |
| `mixamorig:LeftFoot` / `RightFoot` | `leftFoot` / `rightFoot` |
| `mixamorig:LeftToeBase` / `RightToeBase` | `leftToes` / `rightToes` |

**Fingers (30 bones)**

Each hand has 15 bones covering thumb, index, middle, ring, and little fingers (proximal / intermediate / distal), mapped to the corresponding VRM 1.0 names (e.g. `leftThumbMetacarpal`, `rightIndexDistal`).

## Output format

- **Format**: GLB binary (standard glTF 2.0 binary container)
- **Extension**: `VRMC_vrm_animation` v1.0
- **Compatible with**: VRoid Hub, @pixiv/three-vrm-animation v3.4.1+, Three.js r177+

## Testing

```bash
npm test
```

Runs 30 unit tests covering bone mapping, animation channel filtering, GLB output, output path resolution, batch conversion, and input validation.

## Project structure

```
fbx2vrma-converter/
├── fbx2vrma-converter.js   # Main converter
├── test.js                 # Unit tests
├── scripts/
│   └── postinstall.js      # Skips setup if binary already exists
├── setup.sh                # FBX2glTF download script (macOS/Linux)
├── setup.bat               # FBX2glTF download script (Windows)
├── package.json
├── LICENSE
└── .gitignore
```

## License

MIT — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [FBX2glTF](https://github.com/facebookincubator/FBX2glTF) — FBX to glTF conversion
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) — VRM support for Three.js
- [Mixamo](https://www.mixamo.com/) — Animation source
