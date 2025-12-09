# rebuild-git

Bare friendly fork of [isomorphic-git](https://github.com/isomorphic-git/isomorphic-git/) focused on git rebuild from in-memory objects

## Usage

```js
const git = require('rebuild-git')

const o = {
  id: 'my-id',
  type: 'commit',
  data: Buffer.from('hello world')
}

// Write the object to your repo using fs
const oid = await git.writeObject({
  type: o.type,
  object: o.data
})

if (oid !== o.id) {
  // Bad object
}
```

## License

Apache-2.0
