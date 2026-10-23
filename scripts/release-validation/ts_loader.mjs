import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(new URL('./ts_resolve_hook.mjs', import.meta.url), pathToFileURL(process.cwd()).href)
