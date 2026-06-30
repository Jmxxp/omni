import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const children = [];

function start(name, command, args) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows,
  });

  child.stdout?.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));

  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("core", "python", ["services/core/server.py"]);
start("ui", isWindows ? "npm.cmd" : "npm", ["run", "dev", "-w", "@omni/desktop"]);

