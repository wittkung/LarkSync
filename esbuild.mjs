import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
    entryPoints: [
        'src/extension.ts',
        'src/markdownWorker.ts',  // Worker 线程，需要独立文件
    ],
    bundle: true,
    outdir: 'out',
    external: ['vscode'], // vscode 由宿主提供，不打包
    format: 'cjs',
    platform: 'node',
    target: 'es2020',
    sourcemap: true,
    minify: false, // 开发阶段保留可读性
};

if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('[esbuild] 监听模式已启动，等待文件变更...');
} else {
    await esbuild.build(buildOptions);
    console.log('[esbuild] 打包完成 → out/extension.js');
}
