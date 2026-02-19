'use strict'

const fs = require('fs')
const path = require('path')

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.svg', '.tiff', '.tif',
  '.gif', '.pdf', '.jp2', '.webp', '.heic', '.avif'
])

function walk(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walk(fullPath))
    } else if (entry.isFile()) {
      if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath)
      }
    }
  }
  return results
}

class ListsPlugin {

  constructor(options, context) {
    this.options = Object.assign({}, ListsPlugin.defaults, options)
    this.context = context
  }

  async import(payload) {
    this.context.logger.trace('Called import hook from plugin-lists')

    const result = await this.context.dialog.open({
      properties: ['openDirectory']
    })

    if (!result || !result.length) return

    const dir = result[0]
    const files = walk(dir)

    const graph = await Promise.all(files.map(async (filePath) => {
      const relDir = path.relative(dir, path.dirname(filePath))
      const list = relDir ? [relDir] : []
      const title = path.basename(filePath, path.extname(filePath))

      if (path.extname(filePath).toLowerCase() === '.pdf') {
        const sharp = await this.context.sharp.open(filePath)
        const { pages = 1 } = await sharp.metadata()
        const photo = Array.from({ length: pages }, (_, page) => ({
          "http://purl.org/dc/elements/1.1/title": title,
          path: filePath,
          mimetype: 'application/pdf',
          page
        }))
        return { photo, list, "http://purl.org/dc/elements/1.1/title": title }
      }

      return {
        photo: [{ path: filePath, "http://purl.org/dc/elements/1.1/title": title }],
        list,
        "http://purl.org/dc/elements/1.1/title": title
      }
    }))
    console.log(graph)
    payload.data = [{ '@graph': graph }]
  }
}

ListsPlugin.defaults = {}

module.exports = ListsPlugin
