/**
 * Paper theme — placeholder. Real palette + grain texture land in PR 2.
 *
 * Until then this is intentionally identical to `darkTheme` (apart from `name`
 * and `texture`) so the architecture compiles and ships in PR 1 without
 * exposing a half-designed alternate to users.
 */

import { darkTheme } from './dark'
import type { Theme } from './types'

export const paperTheme: Theme = {
  ...darkTheme,
  name: 'paper',
}
