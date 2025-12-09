const b4a = require('b4a')
const fs = require('fs/promises')
const { join, dirname } = require('path')
const pako = require('pako')
const crypto = require('crypto')

// From https://github.com/isomorphic-git/isomorphic-git/blob/main/src/models/GitTree.js

function mode2type(mode) {
  // prettier-ignore
  switch (mode) {
    case '040000': return 'tree'
    case '100644': return 'blob'
    case '100755': return 'blob'
    case '120000': return 'blob'
    case '160000': return 'commit'
  }
  throw new Error(`Unexpected GitTree entry mode: ${mode}`)
}

function parseBuffer(buffer) {
  const _entries = []
  let cursor = 0
  while (cursor < buffer.length) {
    const space = buffer.indexOf(32, cursor)
    if (space === -1) {
      throw new Error(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next space character.`
      )
    }
    const nullchar = buffer.indexOf(0, cursor)
    if (nullchar === -1) {
      throw new Error(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next null character.`
      )
    }
    let mode = buffer.slice(cursor, space).toString('utf8')
    if (mode === '40000') mode = '040000' // makes it line up neater in printed output
    const type = mode2type(mode)
    const path = buffer.slice(space + 1, nullchar).toString('utf8')

    // Prevent malicious git repos from writing to "..\foo" on clone etc
    if (path.includes('\\') || path.includes('/')) {
      throw new Error(`Unsafe path: ${path}`)
    }

    const oid = buffer.slice(nullchar + 1, nullchar + 21).toString('hex')
    cursor = nullchar + 21
    _entries.push({ mode, path, oid, type })
  }
  return _entries
}

function limitModeToAllowed(mode) {
  if (typeof mode === 'number') {
    mode = mode.toString(8)
  }
  // tree
  if (mode.match(/^0?4.*/)) return '040000' // Directory
  if (mode.match(/^1006.*/)) return '100644' // Regular non-executable file
  if (mode.match(/^1007.*/)) return '100755' // Regular executable file
  if (mode.match(/^120.*/)) return '120000' // Symbolic link
  if (mode.match(/^160.*/)) return '160000' // Commit (git submodule reference)
  throw new Error(`Could not understand file mode: ${mode}`)
}

function nudgeIntoShape(entry) {
  if (!entry.oid && entry.sha) {
    entry.oid = entry.sha // Github
  }
  entry.mode = limitModeToAllowed(entry.mode) // index
  if (!entry.type) {
    entry.type = mode2type(entry.mode) // index
  }
  return entry
}

class GitTree {
  constructor(entries) {
    if (b4a.isBuffer(entries)) {
      this._entries = parseBuffer(entries)
    } else if (Array.isArray(entries)) {
      this._entries = entries.map(nudgeIntoShape)
    } else {
      throw new Error('invalid type passed to GitTree constructor')
    }
    // Tree entries are not sorted alphabetically in the usual sense (see `compareTreeEntryPath`)
    // but it is important later on that these be sorted in the same order as they would be returned from readdir.
    this._entries.sort((a, b) => -(a < b) || +(a > b))
  }

  static from(tree) {
    return new GitTree(tree)
  }

  render() {
    return this._entries
      .map((entry) => `${entry.mode} ${entry.type} ${entry.oid}    ${entry.path}`)
      .join('\n')
  }

  /**
   * @returns {TreeEntry[]}
   */
  entries() {
    return this._entries
  }

  *[Symbol.iterator]() {
    for (const entry of this._entries) {
      yield entry
    }
  }
}

// Stripped down implementation of writeObject and it's deps
// https://github.com/isomorphic-git/isomorphic-git/blob/main/src/api/writeObject.js

class GitObject {
  static wrap({ type, object }) {
    const header = `${type} ${object.length}\x00`
    const headerLen = header.length
    const totalLength = headerLen + object.length

    // Allocate a single buffer for the header and object, rather than create multiple buffers
    const wrappedObject = new Uint8Array(totalLength)
    for (let i = 0; i < headerLen; i++) {
      wrappedObject[i] = header.charCodeAt(i)
    }
    wrappedObject.set(object, headerLen)

    return wrappedObject
  }

  static unwrap(buffer) {
    const s = buffer.indexOf(32) // first space
    const i = buffer.indexOf(0) // first null value
    const type = buffer.subarray(0, s).toString('utf8') // get type of object
    const length = buffer.subarray(s + 1, i).toString('utf8') // get type of object
    const actualLength = buffer.length - (i + 1)
    // verify length
    if (parseInt(length) !== actualLength) {
      throw new Error(`Length mismatch: expected ${length} bytes but got ${actualLength} instead.`)
    }
    return {
      type,
      object: b4a.from(buffer.subarray(i + 1))
    }
  }
}

async function discoverGitdir({ dotgit }) {
  const dotgitStat = await fs
    .stat(dotgit)
    .catch(() => ({ isFile: () => false, isDirectory: () => false }))

  if (dotgitStat.isDirectory()) {
    return dotgit
  } else if (dotgitStat.isFile()) {
    return fs
      .readFile(dotgit, 'utf8')
      .then((contents) => contents.trimEnd().substring(8))
      .then((submoduleGitdir) => {
        const gitdir = join(dirname(dotgit), submoduleGitdir)
        return gitdir
      })
  } else {
    return dotgit
  }
}

async function writeObjectLoose({ fs, gitdir, object, oid }) {
  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`
  const filepath = `${gitdir}/${source}`

  if (!(await fs.exists(filepath))) await fs.write(filepath, object)
}

async function writeObject({
  dir = './',
  gitdir = join(dir, '.git'),
  type,
  object,
  dryrun = false
}) {
  const updatedGitdir = await discoverGitdir({ dotgit: gitdir })

  switch (type) {
    case 'blob':
    case 'tag':
    case 'commit':
      object = b4a.from(object)
      break
    case 'tree':
      object = GitTree.from(object).toObject()
      break
    default:
      throw new Error(`Bad object type: ${type}`)
  }

  object = GitObject.wrap({ type, object })
  const oid = crypto.createHash('sha1').update(object).digest('hex')
  object = b4a.from(pako.deflate(object))

  if (!dryrun) {
    await writeObjectLoose({ gitdir: updatedGitdir, object, oid })
  }

  return oid
}

module.exports = { GitTree, GitObject, writeObject }
