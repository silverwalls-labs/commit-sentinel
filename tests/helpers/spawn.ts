import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const BIN = resolve(import.meta.dirname, '..', '..', 'index.ts');

export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function runNode(script: string, args: string[], input?: string): Promise<SpawnResult> {
  return new Promise((resolveSpawn, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolveSpawn({ exitCode: code ?? 0, stdout, stderr }));
    child.stdin.end(input);
  });
}

export function runCli(args: string[], input?: string): Promise<SpawnResult> {
  return runNode(BIN, args, input);
}
