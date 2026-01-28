#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { Command } = require('commander');

class FBXToVRMAConverterFixed {
  constructor() {
    this.program = new Command();
    this.setupCommands();
    
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
      'mixamorig:RightToeBase': 'rightToes'
    };
  }

  setupCommands() {
    this.program
      .name('fbx-to-vrma-converter-fixed')
      .description('Convert FBX to VRMA with improved animation timing (Fixed Version)')
      .version('7.0.0')
      .requiredOption('-i, --input <path>', 'Input FBX file path')
      .requiredOption('-o, --output <path>', 'Output VRMA file path')
      .option('--fbx2gltf <path>', 'Path to FBX2glTF binary', './FBX2glTF-darwin-x64')
      .option('--framerate <fps>', 'Animation framerate', '30')
      .parse();
  }

  async convert(inputPath, outputPath, fbx2gltfPath, framerate) {
    try {
      console.log(`Converting ${inputPath} to ${outputPath} with improved timing...`);
      
      // Step 1: FBXをglTF (JSON + embedded) に変換
      const tempGltfPath = path.join(path.dirname(outputPath), 'temp.gltf');
      await this.convertFBXToGLTF(inputPath, tempGltfPath, fbx2gltfPath);
      
      // Step 2: glTFファイルを読み込み
      const gltfData = await fs.readJson(tempGltfPath);
      
      // Step 3: アニメーション時間を詳細分析して修正
      const enhancedGltfData = this.enhanceAnimationTiming(gltfData, parseInt(framerate));
      
      // Step 4: バイナリファイルを埋め込み
      const embeddedGltfData = await this.embedBinaryData(enhancedGltfData, path.dirname(tempGltfPath));
      
      // Step 5: VRMA形式に変換
      const vrmaData = this.convertToVRMAWithTiming(embeddedGltfData);
      
      // Step 6: VRMAファイルとして保存
      await fs.writeJson(outputPath, vrmaData, { spaces: 2 });
      
      // Step 7: 一時ファイルを削除
      await this.cleanupTempFiles([tempGltfPath]);
      
      console.log(`Successfully converted to ${outputPath} (with improved timing)`);
      return true;
    } catch (error) {
      console.error('Conversion failed:', error.message);
      return false;
    }
  }

  async convertFBXToGLTF(inputPath, outputPath, fbx2gltfPath) {
    const fbx2gltfFullPath = path.resolve(fbx2gltfPath);
    const outputDir = path.dirname(outputPath);
    const outputName = path.basename(outputPath, '.gltf');
    
    // 埋め込み形式でFBX2glTFを実行
    const command = `"${fbx2gltfFullPath}" -i "${inputPath}" -o "${path.join(outputDir, outputName)}" --embed`;
    console.log(`Executing: ${command}`);
    
    try {
      execSync(command, { stdio: 'pipe' });
      
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
    
    const command = `"${fbx2gltfFullPath}" -i "${inputPath}" -o "${path.join(outputDir, outputName)}"`;
    
    try {
      execSync(command, { stdio: 'pipe' });
      
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
    const vrmaData = {
      asset: gltfData.asset,
      scene: gltfData.scene,
      scenes: gltfData.scenes,
      nodes: gltfData.nodes,
      animations: this.processAnimationsWithTiming(gltfData.animations, animationDuration),
      accessors: gltfData.accessors,
      bufferViews: gltfData.bufferViews,
      buffers: gltfData.buffers,
      samplers: gltfData.samplers,
      extensionsUsed: ['VRMC_vrm_animation'],
      extensions: {
        'VRMC_vrm_animation': {
          specVersion: '1.0',
          humanoid: {
            humanBones: this.generateHumanBones(gltfData)
          },
          meta: {
            duration: animationDuration,
            frameCount: gltfData.extras?.animationMetadata?.frameCount || 0,
            framerate: gltfData.extras?.animationMetadata?.framerate || 30
          }
        }
      }
    };

    // オプショナルフィールドを追加
    if (gltfData.materials) vrmaData.materials = gltfData.materials;
    if (gltfData.meshes) vrmaData.meshes = gltfData.meshes;
    if (gltfData.skins) vrmaData.skins = gltfData.skins;
    if (gltfData.textures) vrmaData.textures = gltfData.textures;
    if (gltfData.images) vrmaData.images = gltfData.images;

    console.log(`Generated VRMA with ${Object.keys(this.generateHumanBones(gltfData)).length} bones and ${animationDuration}s duration`);
    
    return vrmaData;
  }

  processAnimationsWithTiming(animations, duration) {
    if (!animations || animations.length === 0) {
      return [];
    }

    return animations.map((animation, index) => ({
      name: animation.name || `VRMAnimation${index}`,
      channels: animation.channels,
      samplers: animation.samplers,
      extras: {
        duration: duration,
        vrmAnimationMetadata: {
          calculatedDuration: duration,
          originalName: animation.name
        }
      }
    }));
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
    const success = await this.convert(
      options.input, 
      options.output, 
      options.fbx2gltf,
      options.framerate
    );
    process.exit(success ? 0 : 1);
  }
}

// メイン実行
if (require.main === module) {
  const converter = new FBXToVRMAConverterFixed();
  converter.run().catch(console.error);
}

module.exports = FBXToVRMAConverterFixed;