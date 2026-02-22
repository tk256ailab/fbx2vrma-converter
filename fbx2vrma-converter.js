#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { Command } = require('commander');

function getDefaultBinaryName() {
  const platform = os.platform(); // 'darwin' | 'linux' | 'win32'
  const arch = os.arch();         // 'x64' | 'arm64' など

  if (platform === 'win32') {
    return 'FBX2glTF-windows-x64.exe';
  }
  if (platform === 'linux') {
    return 'FBX2glTF-linux-x64';
  }
  // darwin: arm64でもRosetta 2経由でx64バイナリを使用
  return 'FBX2glTF-darwin-x64';
}

class FBXToVRMAConverterFixed {
  constructor({ parse = false } = {}) {
    this.program = new Command();
    this.setupCommands(parse);
    
    // ヒューマノイドボーンマッピング (Mixamo -> VRM)
    this.humanoidBoneMapping = {
      'mixamorig:Hips': 'hips',
      'mixamorig:Spine': 'spine',
      'mixamorig:Spine1': 'chest',
      'mixamorig:Spine2': 'upperChest',
      'mixamorig:Neck': 'neck',
      'mixamorig:Head': 'head',
      'mixamorig:LeftShoulder': 'leftShoulder',
      'mixamorig:LeftArm': 'leftUpperArm',
      'mixamorig:LeftForeArm': 'leftLowerArm',
      'mixamorig:LeftHand': 'leftHand',
      'mixamorig:RightShoulder': 'rightShoulder',
      'mixamorig:RightArm': 'rightUpperArm',
      'mixamorig:RightForeArm': 'rightLowerArm',
      'mixamorig:RightHand': 'rightHand',
      'mixamorig:LeftUpLeg': 'leftUpperLeg',
      'mixamorig:LeftLeg': 'leftLowerLeg',
      'mixamorig:LeftFoot': 'leftFoot',
      'mixamorig:RightUpLeg': 'rightUpperLeg',
      'mixamorig:RightLeg': 'rightLowerLeg',
      'mixamorig:RightFoot': 'rightFoot',
      'mixamorig:LeftToeBase': 'leftToes',
      'mixamorig:RightToeBase': 'rightToes',

      // 左手 指ボーン (Mixamo → VRM 1.0)
      'mixamorig:LeftHandThumb1':  'leftThumbMetacarpal',
      'mixamorig:LeftHandThumb2':  'leftThumbProximal',
      'mixamorig:LeftHandThumb3':  'leftThumbDistal',
      'mixamorig:LeftHandIndex1':  'leftIndexProximal',
      'mixamorig:LeftHandIndex2':  'leftIndexIntermediate',
      'mixamorig:LeftHandIndex3':  'leftIndexDistal',
      'mixamorig:LeftHandMiddle1': 'leftMiddleProximal',
      'mixamorig:LeftHandMiddle2': 'leftMiddleIntermediate',
      'mixamorig:LeftHandMiddle3': 'leftMiddleDistal',
      'mixamorig:LeftHandRing1':   'leftRingProximal',
      'mixamorig:LeftHandRing2':   'leftRingIntermediate',
      'mixamorig:LeftHandRing3':   'leftRingDistal',
      'mixamorig:LeftHandPinky1':  'leftLittleProximal',
      'mixamorig:LeftHandPinky2':  'leftLittleIntermediate',
      'mixamorig:LeftHandPinky3':  'leftLittleDistal',

      // 右手 指ボーン (Mixamo → VRM 1.0)
      'mixamorig:RightHandThumb1':  'rightThumbMetacarpal',
      'mixamorig:RightHandThumb2':  'rightThumbProximal',
      'mixamorig:RightHandThumb3':  'rightThumbDistal',
      'mixamorig:RightHandIndex1':  'rightIndexProximal',
      'mixamorig:RightHandIndex2':  'rightIndexIntermediate',
      'mixamorig:RightHandIndex3':  'rightIndexDistal',
      'mixamorig:RightHandMiddle1': 'rightMiddleProximal',
      'mixamorig:RightHandMiddle2': 'rightMiddleIntermediate',
      'mixamorig:RightHandMiddle3': 'rightMiddleDistal',
      'mixamorig:RightHandRing1':   'rightRingProximal',
      'mixamorig:RightHandRing2':   'rightRingIntermediate',
      'mixamorig:RightHandRing3':   'rightRingDistal',
      'mixamorig:RightHandPinky1':  'rightLittleProximal',
      'mixamorig:RightHandPinky2':  'rightLittleIntermediate',
      'mixamorig:RightHandPinky3':  'rightLittleDistal',
    };
  }

  setupCommands(parse) {
    this.program
      .name('fbx-to-vrma-converter-fixed')
      .description('Convert FBX to VRMA with improved animation timing (Fixed Version)')
      .version('1.0.0')
      .requiredOption('-i, --input <path>', 'Input FBX file path')
      .requiredOption('-o, --output <path>', 'Output VRMA file path')
      .option('--fbx2gltf <path>', 'Path to FBX2glTF binary', `./${getDefaultBinaryName()}`)
      .option('--framerate <fps>', 'Animation framerate', '30');

    if (parse) {
      this.program.parse();
    }
  }

  async convert(inputPath, outputPath, fbx2gltfPath, framerate) {
    // finally で確実に削除できるよう try の外で宣言
    const tempGltfPath = path.join(path.dirname(outputPath), `temp_${Date.now()}.gltf`);
    try {
      // 入力ファイルの存在チェック
      if (!await fs.pathExists(inputPath)) {
        throw new Error(`Input FBX file not found: ${inputPath}`);
      }

      // FBX2glTFバイナリの存在チェック
      const fbx2gltfFullPath = path.resolve(fbx2gltfPath);
      if (!await fs.pathExists(fbx2gltfFullPath)) {
        throw new Error(`FBX2glTF binary not found: ${fbx2gltfFullPath}\nRun 'npm run setup' to download it.`);
      }

      console.log(`Converting ${inputPath} to ${outputPath}...`);

      // Step 1: FBXをglTF (JSON + embedded) に変換
      await this.convertFBXToGLTF(inputPath, tempGltfPath, fbx2gltfPath);

      // Step 2: glTFファイルを読み込み
      const gltfData = await fs.readJson(tempGltfPath);

      // Step 3: アニメーション時間を詳細分析して修正
      const enhancedGltfData = this.enhanceAnimationTiming(gltfData, parseInt(framerate));

      // Step 4: バイナリファイルを埋め込み
      const embeddedGltfData = await this.embedBinaryData(enhancedGltfData, path.dirname(tempGltfPath));

      // Step 5: VRMA形式に変換
      const vrmaData = this.convertToVRMAWithTiming(embeddedGltfData);

      // Step 6: VRMAファイルをGLBバイナリとして保存
      await this.saveAsGLB(vrmaData, outputPath);

      console.log(`Successfully converted to ${outputPath}`);
      return true;
    } catch (error) {
      console.error('Conversion failed:', error.message);
      return false;
    } finally {
      // Step 7: エラー有無にかかわらず一時ファイルを削除
      await this.cleanupTempFiles([tempGltfPath]);
    }
  }

  async convertFBXToGLTF(inputPath, outputPath, fbx2gltfPath) {
    const fbx2gltfFullPath = path.resolve(fbx2gltfPath);
    const outputDir = path.dirname(outputPath);
    const outputName = path.basename(outputPath, '.gltf');
    
    // 埋め込み形式でFBX2glTFを実行
    const args = ['-i', inputPath, '-o', path.join(outputDir, outputName), '--embed'];
    console.log(`Executing: ${fbx2gltfFullPath} ${args.join(' ')}`);

    try {
      execFileSync(fbx2gltfFullPath, args, { stdio: 'pipe' });
      
      const actualOutputPath = path.join(outputDir, `${outputName}_out`, `${outputName}.gltf`);
      if (await fs.pathExists(actualOutputPath)) {
        await fs.move(actualOutputPath, outputPath);
        // 一時ディレクトリを削除
        await fs.remove(path.join(outputDir, `${outputName}_out`));
      }
    } catch (error) {
      // 埋め込みが失敗した場合は通常の方法で
      console.log('Embed failed, trying normal conversion...');
      await this.convertFBXToGLTFNormal(inputPath, outputPath, fbx2gltfPath);
    }
  }

  async convertFBXToGLTFNormal(inputPath, outputPath, fbx2gltfPath) {
    const fbx2gltfFullPath = path.resolve(fbx2gltfPath);
    const outputDir = path.dirname(outputPath);
    const outputName = path.basename(outputPath, '.gltf');
    
    const args = ['-i', inputPath, '-o', path.join(outputDir, outputName)];

    try {
      execFileSync(fbx2gltfFullPath, args, { stdio: 'pipe' });
      
      const actualOutputPath = path.join(outputDir, `${outputName}_out`, `${outputName}.gltf`);
      if (await fs.pathExists(actualOutputPath)) {
        await fs.move(actualOutputPath, outputPath);
        // binファイルも移動
        const actualBinPath = path.join(outputDir, `${outputName}_out`, 'buffer.bin');
        const targetBinPath = path.join(outputDir, `${outputName}.bin`);
        if (await fs.pathExists(actualBinPath)) {
          await fs.move(actualBinPath, targetBinPath);
        }
        // 一時ディレクトリを削除
        await fs.remove(path.join(outputDir, `${outputName}_out`));
      }
    } catch (error) {
      throw new Error(`FBX2glTF conversion failed: ${error.message}`);
    }
  }

  enhanceAnimationTiming(gltfData, framerate) {
    console.log('Enhancing animation timing data...');
    
    if (!gltfData.animations || gltfData.animations.length === 0) {
      console.log('No animations found');
      return gltfData;
    }

    // アニメーション時間の詳細計算
    let maxDuration = 0;
    
    gltfData.animations.forEach((animation, animIndex) => {
      console.log(`Processing animation ${animIndex}: ${animation.name}`);
      
      if (animation.samplers && gltfData.accessors) {
        animation.samplers.forEach((sampler, samplerIndex) => {
          if (sampler.input !== undefined && gltfData.accessors[sampler.input]) {
            const timeAccessor = gltfData.accessors[sampler.input];
            
            // 時間データの分析
            if (timeAccessor.type === 'SCALAR' && timeAccessor.max && timeAccessor.max.length > 0) {
              const endTime = timeAccessor.max[0];
              if (endTime > maxDuration) {
                maxDuration = endTime;
              }
              
              console.log(`  Sampler ${samplerIndex}: ${timeAccessor.count} frames, max time: ${endTime}s`);
            }
          }
        });
      }
    });

    console.log(`Calculated max animation duration: ${maxDuration} seconds`);
    
    // VRMAnimationに対応した追加のメタデータを注入
    if (!gltfData.extras) {
      gltfData.extras = {};
    }
    
    gltfData.extras.animationMetadata = {
      maxDuration: maxDuration,
      framerate: framerate,
      frameCount: Math.ceil(maxDuration * framerate),
      calculatedAt: new Date().toISOString()
    };

    return gltfData;
  }

  async embedBinaryData(gltfData, gltfDir) {
    if (!gltfData.buffers || gltfData.buffers.length === 0) {
      console.log('No buffers to embed');
      return gltfData;
    }

    for (let i = 0; i < gltfData.buffers.length; i++) {
      const buffer = gltfData.buffers[i];
      
      if (buffer.uri && !buffer.uri.startsWith('data:')) {
        // 外部ファイル参照の場合
        const bufferPath = path.join(gltfDir, buffer.uri);
        
        if (await fs.pathExists(bufferPath)) {
          const bufferData = await fs.readFile(bufferPath);
          const base64Data = bufferData.toString('base64');
          const dataUri = `data:application/octet-stream;base64,${base64Data}`;
          
          gltfData.buffers[i].uri = dataUri;
          console.log(`Embedded buffer: ${buffer.uri} (${bufferData.length} bytes)`);
        } else {
          console.warn(`Buffer file not found: ${buffer.uri}`);
        }
      }
    }

    return gltfData;
  }

  convertToVRMAWithTiming(gltfData) {
    console.log('Converting to VRMA with enhanced timing...');
    
    // アニメーション時間の詳細取得
    let animationDuration = 5.0; // デフォルト
    
    if (gltfData.extras && gltfData.extras.animationMetadata) {
      animationDuration = gltfData.extras.animationMetadata.maxDuration;
      console.log(`Using calculated duration: ${animationDuration} seconds`);
    }

    // VRMAファイルを作成
    const humanBones = this.generateHumanBones(gltfData);
    const metadata = gltfData.extras?.animationMetadata;
    const vrmaData = {
      asset: gltfData.asset,
      scene: gltfData.scene,
      scenes: gltfData.scenes,
      // mesh/skin参照を除去: meshes/skins を出力しない場合、
      // nodes にそれらへのインデックスが残ると GLTFLoader が
      // undefined を解決しようとして isSkinnedMesh エラーになる。
      // scale も除去: VRMA の休止姿勢は translation のみで定義する
      // (VRoid Studio の出力形式に合わせる)
      nodes: gltfData.nodes?.map(({ mesh, skin, scale, ...rest }) => rest),
      animations: this.processAnimationsWithTiming(gltfData.animations, animationDuration, humanBones),
      accessors: gltfData.accessors,
      bufferViews: gltfData.bufferViews,
      buffers: gltfData.buffers,
      extensionsUsed: ['VRMC_vrm_animation'],
      extensions: {
        'VRMC_vrm_animation': {
          specVersion: '1.0',
          humanoid: {
            humanBones: humanBones
          }
        }
      },
      // 仕様外のメタデータは extras に格納
      extras: {
        duration: animationDuration,
        frameCount: metadata?.frameCount ?? 0,
        framerate: metadata?.framerate ?? 30
      }
    };

    console.log(`Generated VRMA with ${Object.keys(humanBones).length} bones and ${animationDuration}s duration`);
    
    return vrmaData;
  }

  processAnimationsWithTiming(animations, duration, humanBones = {}) {
    if (!animations || animations.length === 0) {
      return [];
    }

    // ノードインデックス → ボーン名の逆引きマップを構築
    const nodeToHumanBone = {};
    for (const [boneName, boneData] of Object.entries(humanBones)) {
      nodeToHumanBone[boneData.node] = boneName;
    }

    return animations.map((animation, index) => {
      // VRMA仕様に違反するチャンネルを除去:
      //   - スケール: すべてのヒューマノイドボーンで禁止
      //   - 平行移動: hips 以外のヒューマノイドボーンで禁止
      const usedSamplerIndices = new Set();
      const filteredChannels = (animation.channels || []).filter(channel => {
        const nodeIndex = channel.target?.node;
        const path = channel.target?.path;
        const boneName = nodeToHumanBone[nodeIndex];

        if (boneName === undefined) return true; // ヒューマノイドボーン以外は通す

        if (path === 'scale') {
          console.log(`  Removed scale channel for bone: ${boneName}`);
          return false;
        }
        if (path === 'translation' && boneName !== 'hips') {
          console.log(`  Removed translation channel for non-hips bone: ${boneName}`);
          return false;
        }
        return true;
      });

      // 残ったチャンネルが参照するサンプラーのみを収集し、インデックスを詰め直す
      filteredChannels.forEach(ch => usedSamplerIndices.add(ch.sampler));
      const oldToNewSampler = {};
      const filteredSamplers = [];
      [...usedSamplerIndices].sort((a, b) => a - b).forEach(oldIdx => {
        oldToNewSampler[oldIdx] = filteredSamplers.length;
        filteredSamplers.push(animation.samplers[oldIdx]);
      });

      const remappedChannels = filteredChannels.map(ch => ({
        ...ch,
        sampler: oldToNewSampler[ch.sampler],
      }));

      const removedCount = (animation.channels?.length ?? 0) - filteredChannels.length;
      if (removedCount > 0) {
        console.log(`  Animation "${animation.name}": removed ${removedCount} invalid channel(s)`);
      }

      return {
        name: animation.name || `VRMAnimation${index}`,
        channels: remappedChannels,
        samplers: filteredSamplers,
      };
    });
  }

  generateHumanBones(gltfData) {
    const humanBones = {};
    
    if (!gltfData.nodes) {
      return humanBones;
    }

    gltfData.nodes.forEach((node, index) => {
      if (node.name && this.humanoidBoneMapping[node.name]) {
        const vrmBoneName = this.humanoidBoneMapping[node.name];
        humanBones[vrmBoneName] = {
          node: index
        };
      }
    });

    return humanBones;
  }

  async saveAsGLB(vrmaData, outputPath) {
    // base64 data URI のバッファを取り出し、バイナリ化する
    const jsonData = JSON.parse(JSON.stringify(vrmaData));
    let binBuffer = Buffer.alloc(0);

    if (jsonData.buffers?.length > 0 && jsonData.buffers[0].uri?.startsWith('data:')) {
      const base64 = jsonData.buffers[0].uri.split(',')[1];
      binBuffer = Buffer.from(base64, 'base64');
      delete jsonData.buffers[0].uri; // GLB では URI を持たない
    }

    // JSON チャンク (4 バイト境界、スペースでパディング)
    const jsonBytes = Buffer.from(JSON.stringify(jsonData), 'utf8');
    const jsonPadded = Math.ceil(jsonBytes.length / 4) * 4;
    const jsonChunk = Buffer.alloc(jsonPadded, 0x20);
    jsonBytes.copy(jsonChunk);

    // BIN チャンク (4 バイト境界、ゼロでパディング)
    const hasBin = binBuffer.length > 0;
    const binPadded = hasBin ? Math.ceil(binBuffer.length / 4) * 4 : 0;
    const binChunk = Buffer.alloc(binPadded, 0x00);
    if (hasBin) binBuffer.copy(binChunk);

    // ファイル全体のサイズを計算
    const totalLength = 12                            // GLB ヘッダ
      + 8 + jsonPadded                               // JSON チャンク
      + (hasBin ? 8 + binPadded : 0);               // BIN チャンク

    const glb = Buffer.alloc(totalLength);
    let offset = 0;

    // GLB ヘッダ
    glb.writeUInt32LE(0x46546C67, offset); offset += 4; // magic "glTF"
    glb.writeUInt32LE(2,           offset); offset += 4; // version 2
    glb.writeUInt32LE(totalLength, offset); offset += 4; // total length

    // JSON チャンクヘッダ + データ
    glb.writeUInt32LE(jsonPadded,   offset); offset += 4; // chunk length
    glb.writeUInt32LE(0x4E4F534A,  offset); offset += 4; // chunk type "JSON"
    jsonChunk.copy(glb, offset); offset += jsonPadded;

    // BIN チャンクヘッダ + データ
    if (hasBin) {
      glb.writeUInt32LE(binPadded,    offset); offset += 4; // chunk length
      glb.writeUInt32LE(0x004E4942,  offset); offset += 4; // chunk type "BIN\0"
      binChunk.copy(glb, offset);
    }

    await fs.writeFile(outputPath, glb);
    console.log(`Saved GLB: ${totalLength} bytes (JSON: ${jsonPadded}, BIN: ${binPadded})`);
  }

  async convertDirectory(inputDir, outputDir, fbx2gltfPath, framerate) {
    const entries = await fs.readdir(inputDir);
    const fbxFiles = entries.filter(f => path.extname(f).toLowerCase() === '.fbx');

    if (fbxFiles.length === 0) {
      console.error(`No FBX files found in: ${inputDir}`);
      return false;
    }

    await fs.ensureDir(outputDir);
    console.log(`Found ${fbxFiles.length} FBX file(s) in ${inputDir}`);

    let successCount = 0;
    for (const file of fbxFiles) {
      const inputPath  = path.join(inputDir, file);
      const outputPath = path.join(outputDir, path.basename(file, path.extname(file)) + '.vrma');
      console.log(`\n[${successCount + 1}/${fbxFiles.length}] ${file}`);
      const ok = await this.convert(inputPath, outputPath, fbx2gltfPath, framerate);
      if (ok) successCount++;
    }

    console.log(`\nBatch complete: ${successCount}/${fbxFiles.length} succeeded.`);
    return successCount === fbxFiles.length;
  }

  async cleanupTempFiles(filePaths) {
    for (const filePath of filePaths) {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
      
      const binPath = filePath.replace(/\.gltf$/, '.bin');
      if (await fs.pathExists(binPath)) {
        await fs.remove(binPath);
      }
    }
  }

  async run() {
    const options = this.program.opts();
    const inputStat = await fs.stat(options.input).catch(() => null);

    let success;
    if (inputStat?.isDirectory()) {
      // バッチ変換モード
      success = await this.convertDirectory(
        options.input,
        options.output,
        options.fbx2gltf,
        options.framerate
      );
    } else {
      // シングルファイル変換モード
      success = await this.convert(
        options.input,
        options.output,
        options.fbx2gltf,
        options.framerate
      );
    }
    process.exit(success ? 0 : 1);
  }
}

// メイン実行
if (require.main === module) {
  const converter = new FBXToVRMAConverterFixed({ parse: true });
  converter.run().catch(console.error);
}

module.exports = FBXToVRMAConverterFixed;
module.exports.getDefaultBinaryName = getDefaultBinaryName;