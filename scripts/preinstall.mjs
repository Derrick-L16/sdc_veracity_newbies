// Cross-platform equivalent of the original `sh -c` preinstall check, so
// `pnpm install` also works from PowerShell/cmd on Windows (not only Git Bash).
import { rmSync } from 'node:fs'

for (const file of ['package-lock.json', 'yarn.lock']) rmSync(file, { force: true })
if (!/^pnpm\//.test(process.env.npm_config_user_agent ?? '')) {
  console.error('Use pnpm instead')
  process.exit(1)
}
