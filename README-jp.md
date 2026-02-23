# FBX to VRMA コンバーター v2.1

FBXアニメーションファイルをVRMA（VRMアニメーション）形式に変換します。
VRoid Hub、@pixiv/three-vrm-animation、その他のVRM 1.0対応ツールと互換性があります。

[English README](README.md) | 日本語 README

## 機能

- **FBX → VRMA変換** — MixamoのFBXアニメーションをVRMA形式に変換
- **GLBバイナリ出力** — VRoid Hub対応の標準GLBバイナリ形式で出力
- **52ボーン対応** — 指ボーン30本を含む全ヒューマノイドボーンをマッピング
- **VRMA仕様準拠** — VRMC_vrm_animation 1.0の仕様に従い、不正なscale/translationチャンネルを除去
- **バッチ変換** — ディレクトリ内のFBXファイルを一括変換
- **クロスプラットフォーム** — macOS・Windows・Linux対応。バイナリパスはOSに応じて自動検出

## 必要な環境

- Node.js 18+
- FBX2glTFバイナリ（セットアップスクリプトで自動ダウンロード）
- macOS（Apple SiliconはRosetta 2が必要）、Windows、またはLinux

## インストール

```bash
git clone https://github.com/TK-256/fbx2vrma-converter.git
cd fbx2vrma-converter
npm install
```

`npm install` 実行時にセットアップスクリプトが自動でFBX2glTFバイナリをダウンロードします。
失敗した場合は手動で実行してください：

```bash
# macOS / Linux
./setup.sh

# Windows
setup.bat
```

### Apple Silicon（M1/M2/M3）

FBX2glTFバイナリはx64のみ提供されています。Rosetta 2をインストールして実行してください：

```bash
softwareupdate --install-rosetta --agree-to-license
```

### バイナリの手動ダウンロード

スクリプトが失敗した場合は、[FBX2glTF リリースページ](https://github.com/facebookincubator/FBX2glTF/releases/tag/v0.9.7)からバイナリをダウンロードしてプロジェクトディレクトリに配置してください：

| プラットフォーム | バイナリファイル名 |
|---|---|
| macOS | `FBX2glTF-darwin-x64` |
| Windows | `FBX2glTF-windows-x64.exe` |
| Linux | `FBX2glTF-linux-x64` |

## 使い方

### 単一ファイルの変換

`-o` は省略可能です。省略した場合、入力ファイルと同じディレクトリに同じファイル名で `.vrma` 拡張子として保存されます。

```bash
# 入力ファイルと同じディレクトリに input.vrma として保存
node fbx2vrma-converter.js -i input.fbx

# 指定したディレクトリに input.vrma として保存
node fbx2vrma-converter.js -i input.fbx -o ./output/

# ファイル名まで明示して保存
node fbx2vrma-converter.js -i input.fbx -o ./output/animation.vrma
```

### バッチ変換

`-i` にディレクトリを指定すると、FBXファイルをまとめて変換します。`-o` を省略した場合は入力ディレクトリに保存されます。

```bash
node fbx2vrma-converter.js -i ./FBX/ -o ./VRMA/
```

出力ファイル名は入力ファイル名から自動生成されます（`Walk.fbx` → `Walk.vrma`）。

### オプション

| オプション | 説明 | デフォルト |
|---|---|---|
| `-i, --input <path>` | 入力FBXファイルまたはディレクトリ（必須） | — |
| `-o, --output <path>` | 出力VRMAファイルまたはディレクトリ | 入力ファイルと同じディレクトリ |
| `--fbx2gltf <path>` | FBX2glTFバイナリのパス | OSに応じて自動検出 |
| `--framerate <fps>` | アニメーションのフレームレート | `30` |
| `-V, --version` | バージョンを表示 | — |
| `-h, --help` | ヘルプを表示 | — |

## 動作の仕組み

1. FBX2glTFを使ってFBX → glTFに変換
2. アニメーションのタイミング（時間・フレーム数）を解析
3. バイナリバッファをBase64で埋め込み
4. VRMA仕様違反のチャンネルを除去（ヒューマノイドボーンのscale、hips以外のtranslation）
5. Mixamoのボーン名をVRMヒューマノイドボーン名にマッピング
6. ノードからメッシュ・スキン参照と休止姿勢のscaleを除去
7. GLBバイナリとして出力

## ボーンマッピング

MixamoのボーンをVRM 1.0ヒューマノイド仕様の52ボーンにマッピングします。

**ボディ（22ボーン）**

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

**指ボーン（30ボーン）**

左右それぞれの手に、親指・人差し指・中指・薬指・小指の3関節（proximal / intermediate / distal）分の15ボーンをマッピングします（例：`leftThumbMetacarpal`、`rightIndexDistal`）。

## 出力形式

- **形式**: GLBバイナリ（標準glTF 2.0バイナリコンテナ）
- **拡張機能**: `VRMC_vrm_animation` v1.0
- **動作確認済み**: VRoid Hub、@pixiv/three-vrm-animation v3.4.1+、Three.js r177+

## プロジェクト構造

```
fbx2vrma-converter/
├── fbx2vrma-converter.js   # メインコンバーター
├── scripts/
│   └── postinstall.js      # バイナリが存在する場合はセットアップをスキップ
├── setup.sh                # FBX2glTFダウンロードスクリプト（macOS/Linux）
├── setup.bat               # FBX2glTFダウンロードスクリプト（Windows）
├── package.json
├── LICENSE
└── .gitignore
```

## ライセンス

MIT — 詳細は [LICENSE](LICENSE) を参照してください。

## 謝辞

- [FBX2glTF](https://github.com/facebookincubator/FBX2glTF) — FBXからglTFへの変換
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) — Three.js用VRMサポート
- [Mixamo](https://www.mixamo.com/) — アニメーションソース
