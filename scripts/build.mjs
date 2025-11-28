import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/application/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/server.bundle.js',
  format: 'esm',
  sourcemap: true,
  // No empaquetar dependencias nativas o problemáticas
  external: [
    '@tensorflow/tfjs-node-gpu',
    'ws',
    'ssh2-sftp-client', 
    'cpu-features',
    '@google-cloud/storage',
    'dotenv',
    'express',
    'cors',
  ],
});

console.log('✅ Build completed: dist/server.bundle.js');
