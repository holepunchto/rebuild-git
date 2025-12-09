declare module '@holepunchto/rebuild-git' {
  export interface WriteObjectOpts {
    // Type of git object
    type: 'blob' | 'tag' | 'commit' | 'tree'
    // Git object
    object: Buffer | Uint8Array
    // Skip writing object
    dryrun: boolean
    // Target directory
    dir: string
    // Target git directory. Defaults to <dir>/.git
    gitdir: string
  }

  export function writeObject(opts: WriteObjectOpts): string
}
