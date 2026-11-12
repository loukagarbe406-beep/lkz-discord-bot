/**
 * FadeHost free slot: Discord bot + wideiptv HLS relay on PORT.
 * Public URL: https://lkz-discord-bot.fadehost.app
 */
import { spawn } from "child_process";

const PORT = String(process.env.PORT || "8080");

function run(name, args, env) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: env,
  });
  child.on("exit", (code, signal) => {
    console.error(
      "[supervisor] " + name + " exited code=" + code + " signal=" + signal
    );
    process.exit(code || 1);
  });
  return child;
}

console.log("[supervisor] wide-relay PORT=" + PORT);
run("wide-relay", ["wide-relay.mjs"], {
  ...process.env,
  PORT: PORT,
});

console.log("[supervisor] discord bot");
run("bot", ["bot.js"], process.env);
