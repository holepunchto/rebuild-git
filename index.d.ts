declare module 'rebuild-git' {
  interface FsLike {
    stat(path: string): Promise<{ isFile(): boolean; isDirectory(): boolean }>
    readFile(path: string, encoding?: string): Promise<Buffer | string>
    writeFile(path: string, data: Buffer | Uint8Array | string, encoding?: string): Promise<void>
    mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>
  }

  export interface WriteObjectOpts {
    // fs/promises-compatible object
    fs?: FsLike
    // Type of git object
    type: 'blob' | 'tag' | 'commit' | 'tree'
    // Git object
    object: Buffer | Uint8Array
    // Skip writing object
    dryrun?: boolean
    // Target directory
    dir?: string
    // Target git directory. Defaults to <dir>/.git
    gitdir?: string
  }

  export interface WriteRefOpts {
    // fs/promises-compatible object
    fs?: FsLike
    // Target directory
    dir?: string
    // Target git directory. Defaults to <dir>/.git
    gitdir?: string
    // Ref path, e.g. 'refs/heads/main' or 'HEAD'
    ref: string
    // Value to write, e.g. a commit OID or 'ref: refs/heads/main'
    value: string
    // Overwrite existing ref
    force?: boolean
  }

  interface TreeEntry {
    mode: string
    path: string
    oid: string
    type: string
  }

  export class GitTree {
    constructor(entries: Buffer | Uint8Array | TreeEntry[])
    static from(tree: Buffer | Uint8Array | TreeEntry[]): GitTree
    render(): string
    toObject(): Buffer
    entries(): TreeEntry[]
    [Symbol.iterator](): IterableIterator<TreeEntry>
  }

  export class GitObject {
    static wrap(opts: { type: string; object: Buffer | Uint8Array }): Uint8Array
    static unwrap(buffer: Buffer | Uint8Array): { type: string; object: Buffer }
  }

  export function writeObject(opts: WriteObjectOpts): Promise<string>
  export function writeRef(opts: WriteRefOpts): Promise<void>
}
