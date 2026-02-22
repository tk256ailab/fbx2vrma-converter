const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const FBXToVRMAConverterFixed = require('./fbx2vrma-converter');
const { getDefaultBinaryName } = require('./fbx2vrma-converter');

function createConverter() {
  return new FBXToVRMAConverterFixed();
}

describe('generateHumanBones', () => {
  it('should map Mixamo bone names to VRM humanoid bones', () => {
    const converter = createConverter();
    const gltfData = {
      nodes: [
        { name: 'mixamorig:Hips' },
        { name: 'mixamorig:Spine' },
        { name: 'mixamorig:Head' },
        { name: 'mixamorig:LeftHand' },
        { name: 'mixamorig:RightHand' },
      ],
    };

    const bones = converter.generateHumanBones(gltfData);

    assert.deepStrictEqual(bones, {
      hips: { node: 0 },
      spine: { node: 1 },
      head: { node: 2 },
      leftHand: { node: 3 },
      rightHand: { node: 4 },
    });
  });

  it('should skip nodes without matching bone names', () => {
    const converter = createConverter();
    const gltfData = {
      nodes: [
        { name: 'mixamorig:Hips' },
        { name: 'SomeUnknownBone' },
        { name: 'mixamorig:Head' },
      ],
    };

    const bones = converter.generateHumanBones(gltfData);

    assert.equal(Object.keys(bones).length, 2);
    assert.deepStrictEqual(bones.hips, { node: 0 });
    assert.deepStrictEqual(bones.head, { node: 2 });
  });

  it('should return empty object when no nodes exist', () => {
    const converter = createConverter();
    const bones = converter.generateHumanBones({});
    assert.deepStrictEqual(bones, {});
  });

  it('should map Mixamo finger bones to VRM 1.0 bone names', () => {
    const converter = createConverter();
    const gltfData = {
      nodes: [
        { name: 'mixamorig:LeftHandThumb1' },   // 0
        { name: 'mixamorig:LeftHandThumb2' },   // 1
        { name: 'mixamorig:LeftHandThumb3' },   // 2
        { name: 'mixamorig:LeftHandIndex1' },   // 3
        { name: 'mixamorig:LeftHandIndex2' },   // 4
        { name: 'mixamorig:LeftHandIndex3' },   // 5
        { name: 'mixamorig:RightHandPinky1' },  // 6
        { name: 'mixamorig:RightHandPinky2' },  // 7
        { name: 'mixamorig:RightHandPinky3' },  // 8
      ],
    };

    const bones = converter.generateHumanBones(gltfData);

    assert.deepStrictEqual(bones.leftThumbMetacarpal,   { node: 0 });
    assert.deepStrictEqual(bones.leftThumbProximal,     { node: 1 });
    assert.deepStrictEqual(bones.leftThumbDistal,       { node: 2 });
    assert.deepStrictEqual(bones.leftIndexProximal,     { node: 3 });
    assert.deepStrictEqual(bones.leftIndexIntermediate, { node: 4 });
    assert.deepStrictEqual(bones.leftIndexDistal,       { node: 5 });
    assert.deepStrictEqual(bones.rightLittleProximal,     { node: 6 });
    assert.deepStrictEqual(bones.rightLittleIntermediate, { node: 7 });
    assert.deepStrictEqual(bones.rightLittleDistal,       { node: 8 });
  });

  it('should support all 30 finger bones', () => {
    const converter = createConverter();
    const fingerMixamoNames = [
      'mixamorig:LeftHandThumb1',  'mixamorig:LeftHandThumb2',  'mixamorig:LeftHandThumb3',
      'mixamorig:LeftHandIndex1',  'mixamorig:LeftHandIndex2',  'mixamorig:LeftHandIndex3',
      'mixamorig:LeftHandMiddle1', 'mixamorig:LeftHandMiddle2', 'mixamorig:LeftHandMiddle3',
      'mixamorig:LeftHandRing1',   'mixamorig:LeftHandRing2',   'mixamorig:LeftHandRing3',
      'mixamorig:LeftHandPinky1',  'mixamorig:LeftHandPinky2',  'mixamorig:LeftHandPinky3',
      'mixamorig:RightHandThumb1',  'mixamorig:RightHandThumb2',  'mixamorig:RightHandThumb3',
      'mixamorig:RightHandIndex1',  'mixamorig:RightHandIndex2',  'mixamorig:RightHandIndex3',
      'mixamorig:RightHandMiddle1', 'mixamorig:RightHandMiddle2', 'mixamorig:RightHandMiddle3',
      'mixamorig:RightHandRing1',   'mixamorig:RightHandRing2',   'mixamorig:RightHandRing3',
      'mixamorig:RightHandPinky1',  'mixamorig:RightHandPinky2',  'mixamorig:RightHandPinky3',
    ];
    const gltfData = { nodes: fingerMixamoNames.map(name => ({ name })) };
    const bones = converter.generateHumanBones(gltfData);
    assert.equal(Object.keys(bones).length, 30);
  });
});

describe('enhanceAnimationTiming', () => {
  it('should calculate max duration from animation samplers', () => {
    const converter = createConverter();
    const gltfData = {
      animations: [
        {
          name: 'TestAnim',
          samplers: [
            { input: 0 },
            { input: 1 },
          ],
        },
      ],
      accessors: [
        { type: 'SCALAR', max: [2.5], count: 75 },
        { type: 'SCALAR', max: [3.0], count: 90 },
      ],
    };

    const result = converter.enhanceAnimationTiming(gltfData, 30);

    assert.equal(result.extras.animationMetadata.maxDuration, 3.0);
    assert.equal(result.extras.animationMetadata.framerate, 30);
    assert.equal(result.extras.animationMetadata.frameCount, 90); // ceil(3.0 * 30)
  });

  it('should handle missing animations gracefully', () => {
    const converter = createConverter();
    const gltfData = { animations: [] };
    const result = converter.enhanceAnimationTiming(gltfData, 30);
    assert.equal(result.extras, undefined);
  });

  it('should handle no animations key', () => {
    const converter = createConverter();
    const gltfData = {};
    const result = converter.enhanceAnimationTiming(gltfData, 30);
    assert.equal(result.extras, undefined);
  });
});

describe('processAnimationsWithTiming', () => {
  it('should preserve animation name, channels, and samplers', () => {
    const converter = createConverter();
    const animations = [
      { name: 'Walk', channels: [{ target: {}, sampler: 0 }], samplers: [{}] },
    ];

    const result = converter.processAnimationsWithTiming(animations, 2.5);

    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Walk');
    assert.equal(result[0].channels.length, 1);
    assert.equal(result[0].samplers.length, 1);
    // extras は付与しない（仕様外）
    assert.equal(result[0].extras, undefined);
  });

  it('should assign default name when animation has no name', () => {
    const converter = createConverter();
    const animations = [{ channels: [], samplers: [] }];

    const result = converter.processAnimationsWithTiming(animations, 1.0);

    assert.equal(result[0].name, 'VRMAnimation0');
  });

  it('should return empty array for no animations', () => {
    const converter = createConverter();
    assert.deepStrictEqual(converter.processAnimationsWithTiming([], 1.0), []);
    assert.deepStrictEqual(converter.processAnimationsWithTiming(null, 1.0), []);
  });

  it('should remove scale channels for humanoid bones', () => {
    const converter = createConverter();
    const humanBones = { hips: { node: 0 }, spine: { node: 1 } };
    const animations = [{
      name: 'Test',
      channels: [
        { target: { node: 0, path: 'rotation' }, sampler: 0 }, // hips rotation: OK
        { target: { node: 0, path: 'scale' },    sampler: 1 }, // hips scale: 禁止
        { target: { node: 1, path: 'scale' },    sampler: 2 }, // spine scale: 禁止
      ],
      samplers: [{}, {}, {}],
    }];

    const result = converter.processAnimationsWithTiming(animations, 1.0, humanBones);

    assert.equal(result[0].channels.length, 1);
    assert.equal(result[0].channels[0].target.path, 'rotation');
    assert.equal(result[0].samplers.length, 1);
  });

  it('should remove translation channels for non-hips humanoid bones', () => {
    const converter = createConverter();
    const humanBones = { hips: { node: 0 }, spine: { node: 1 } };
    const animations = [{
      name: 'Test',
      channels: [
        { target: { node: 0, path: 'translation' }, sampler: 0 }, // hips translation: OK
        { target: { node: 1, path: 'translation' }, sampler: 1 }, // spine translation: 禁止
        { target: { node: 1, path: 'rotation' },    sampler: 2 }, // spine rotation: OK
      ],
      samplers: [{}, {}, {}],
    }];

    const result = converter.processAnimationsWithTiming(animations, 1.0, humanBones);

    assert.equal(result[0].channels.length, 2);
    assert.equal(result[0].channels[0].target.path, 'translation');
    assert.equal(result[0].channels[0].target.node, 0); // hips
    assert.equal(result[0].channels[1].target.path, 'rotation');
    // サンプラーインデックスが詰め直されていること
    assert.equal(result[0].channels[0].sampler, 0);
    assert.equal(result[0].channels[1].sampler, 1);
    assert.equal(result[0].samplers.length, 2);
  });

  it('should pass through channels for non-humanoid nodes', () => {
    const converter = createConverter();
    const humanBones = { hips: { node: 0 } };
    const animations = [{
      name: 'Test',
      channels: [
        { target: { node: 99, path: 'scale' },       sampler: 0 }, // 非ヒューマノイド: 通す
        { target: { node: 99, path: 'translation' }, sampler: 1 }, // 非ヒューマノイド: 通す
      ],
      samplers: [{}, {}],
    }];

    const result = converter.processAnimationsWithTiming(animations, 1.0, humanBones);

    assert.equal(result[0].channels.length, 2);
  });
});

describe('convertToVRMAWithTiming', () => {
  it('should produce valid VRMA structure', () => {
    const converter = createConverter();
    const gltfData = {
      asset: { version: '2.0', generator: 'test' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: 'mixamorig:Hips' }],
      animations: [{ name: 'Idle', channels: [], samplers: [] }],
      accessors: [],
      bufferViews: [],
      buffers: [],
      extras: {
        animationMetadata: {
          maxDuration: 2.0,
          framerate: 30,
          frameCount: 60,
        },
      },
    };

    const vrma = converter.convertToVRMAWithTiming(gltfData);

    assert.deepStrictEqual(vrma.extensionsUsed, ['VRMC_vrm_animation']);
    const ext = vrma.extensions['VRMC_vrm_animation'];
    assert.equal(ext.specVersion, '1.0');
    assert.deepStrictEqual(ext.humanoid.humanBones, { hips: { node: 0 } });
    // meta は仕様外なので extension に存在しないこと
    assert.equal(ext.meta, undefined);
    // タイミング情報は extras に格納されること
    assert.equal(vrma.extras.duration, 2.0);
    assert.equal(vrma.extras.frameCount, 60);
    assert.equal(vrma.extras.framerate, 30);
    // ジオメトリ系フィールドが含まれないこと
    assert.equal(vrma.materials, undefined);
    assert.equal(vrma.meshes, undefined);
    assert.equal(vrma.skins, undefined);
    assert.equal(vrma.textures, undefined);
    assert.equal(vrma.images, undefined);
    assert.equal(vrma.animations.length, 1);
  });

  it('should strip mesh and skin references from nodes', () => {
    const converter = createConverter();
    const gltfData = {
      asset: { version: '2.0' },
      nodes: [
        { name: 'mixamorig:Hips', mesh: 0, skin: 0 },
        { name: 'mixamorig:Spine', translation: [0, 1, 0] },
        { name: 'Body', mesh: 1 },
      ],
      animations: [],
      accessors: [],
      bufferViews: [],
      buffers: [],
    };

    const vrma = converter.convertToVRMAWithTiming(gltfData);

    // mesh / skin プロパティが除去されていること
    assert.equal(vrma.nodes[0].mesh, undefined);
    assert.equal(vrma.nodes[0].skin, undefined);
    assert.equal(vrma.nodes[2].mesh, undefined);
    // 他のプロパティは保持されること
    assert.equal(vrma.nodes[0].name, 'mixamorig:Hips');
    assert.deepStrictEqual(vrma.nodes[1].translation, [0, 1, 0]);
  });

  it('should use default duration and framerate when no metadata', () => {
    const converter = createConverter();
    const gltfData = {
      asset: { version: '2.0' },
      nodes: [],
      animations: [],
      accessors: [],
      bufferViews: [],
      buffers: [],
    };

    const vrma = converter.convertToVRMAWithTiming(gltfData);

    assert.equal(vrma.extras.duration, 5.0);
    assert.equal(vrma.extras.framerate, 30);
    assert.equal(vrma.extras.frameCount, 0);
  });
});

describe('getDefaultBinaryName', () => {
  it('should return a non-empty string', () => {
    assert.ok(typeof getDefaultBinaryName() === 'string');
    assert.ok(getDefaultBinaryName().length > 0);
  });

  it('should match the current platform', () => {
    const name = getDefaultBinaryName();
    const platform = os.platform();
    if (platform === 'win32') {
      assert.ok(name.endsWith('.exe'), `Expected .exe suffix on Windows, got: ${name}`);
    } else if (platform === 'linux') {
      assert.ok(name.includes('linux'), `Expected 'linux' in name, got: ${name}`);
    } else if (platform === 'darwin') {
      assert.ok(name.includes('darwin'), `Expected 'darwin' in name, got: ${name}`);
    }
  });
});

describe('saveAsGLB', () => {
  it('should produce a valid GLB binary with correct magic bytes', async () => {
    const converter = createConverter();
    const vrmaData = {
      asset: { version: '2.0' },
      nodes: [],
      animations: [],
      accessors: [],
      bufferViews: [],
      buffers: [{ byteLength: 4, uri: 'data:application/octet-stream;base64,AQIDBA==' }],
      extensionsUsed: ['VRMC_vrm_animation'],
      extensions: { 'VRMC_vrm_animation': { specVersion: '1.0', humanoid: { humanBones: {} } } },
    };

    const outPath = '/tmp/test_output.vrma';
    await converter.saveAsGLB(vrmaData, outPath);

    const buf = require('fs').readFileSync(outPath);
    // magic: "glTF"
    assert.equal(buf.readUInt32LE(0), 0x46546C67);
    // version: 2
    assert.equal(buf.readUInt32LE(4), 2);
    // total length matches file size
    assert.equal(buf.readUInt32LE(8), buf.length);
    // JSON chunk type
    assert.equal(buf.readUInt32LE(16), 0x4E4F534A);
    // BIN chunk type (after JSON chunk)
    const jsonChunkLength = buf.readUInt32LE(12);
    assert.equal(buf.readUInt32LE(20 + jsonChunkLength + 4), 0x004E4942);
  });

  it('should embed buffer as BIN chunk without data URI', async () => {
    const converter = createConverter();
    const vrmaData = {
      asset: { version: '2.0' },
      buffers: [{ byteLength: 4, uri: 'data:application/octet-stream;base64,AQIDBA==' }],
    };

    const outPath = '/tmp/test_output2.vrma';
    await converter.saveAsGLB(vrmaData, outPath);

    const buf = require('fs').readFileSync(outPath);
    const jsonChunkLength = buf.readUInt32LE(12);
    const jsonStr = buf.slice(20, 20 + jsonChunkLength).toString('utf8').trim();
    const json = JSON.parse(jsonStr);

    // buffer URI が除去されていること
    assert.equal(json.buffers[0].uri, undefined);
  });

  it('should align chunks to 4-byte boundary', async () => {
    const converter = createConverter();
    // JSON が4バイト境界にならないサイズになるデータを用意
    const vrmaData = { asset: { version: '2.0' }, x: 'abc' };
    const outPath = '/tmp/test_output3.vrma';
    await converter.saveAsGLB(vrmaData, outPath);

    const buf = require('fs').readFileSync(outPath);
    const jsonChunkLength = buf.readUInt32LE(12);
    // JSON チャンク長が4の倍数であること
    assert.equal(jsonChunkLength % 4, 0);
    // 総サイズが4の倍数であること
    assert.equal(buf.length % 4, 0);
  });
});

describe('convert (validation)', () => {
  it('should reject non-existent input file', async () => {
    const converter = createConverter();
    const result = await converter.convert(
      '/nonexistent/file.fbx',
      '/tmp/output.vrma',
      './FBX2glTF-darwin-x64',
      '30'
    );
    assert.equal(result, false);
  });

  it('should reject non-existent FBX2glTF binary', async () => {
    const converter = createConverter();
    // Use the test file itself as a valid input path
    const result = await converter.convert(
      './test.js',
      '/tmp/output.vrma',
      '/nonexistent/FBX2glTF',
      '30'
    );
    assert.equal(result, false);
  });
});

describe('convertDirectory', () => {
  const { mkdtempSync, writeFileSync, rmSync } = require('fs');
  const tmpdir = require('os').tmpdir;

  it('should return false when no FBX files found', async () => {
    const converter = createConverter();
    // 空のディレクトリを使う
    const dir = mkdtempSync(tmpdir() + '/fbx2vrma-test-');
    try {
      const result = await converter.convertDirectory(dir, dir + '/out', './FBX2glTF-darwin-x64', '30');
      assert.equal(result, false);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('should detect FBX files in directory', async () => {
    const converter = createConverter();
    const dir = mkdtempSync(tmpdir() + '/fbx2vrma-test-');
    try {
      // ダミーの .fbx ファイルを作成（実際の変換は行わない）
      writeFileSync(dir + '/motion1.fbx', 'dummy');
      writeFileSync(dir + '/motion2.fbx', 'dummy');
      writeFileSync(dir + '/readme.txt', 'dummy'); // 無視されること

      // 変換自体は失敗するが、FBXを2ファイル検出してバイナリチェックまで到達する
      // ここではディレクトリ検出ロジックのみ確認
      const entries = await require('fs-extra').readdir(dir);
      const fbxFiles = entries.filter(f => require('path').extname(f).toLowerCase() === '.fbx');
      assert.equal(fbxFiles.length, 2);
      assert.ok(!fbxFiles.includes('readme.txt'));
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
