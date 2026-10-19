"use strict";
// Explicitly block outdated NSIS/portable targets for commercial distribution.
process.stderr.write("EKIDEN MANAGER の販売パッケージは MSIX のみです。\\nnpm run audit:msix → npm run build:msix を Windows の隔離環境で実行してください。\\nNSIS / Portable EXE は販売用ではありません。\\n");
process.exitCode=2;
