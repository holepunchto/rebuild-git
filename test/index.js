const { test } = require('brittle')
const { writeObject } = require('..')

test('works', async (t) => {
  {
    const oid = await writeObject({
      type: 'commit',
      object: Buffer.from('hello world'),
      dryrun: true
    })

    t.is(oid, 'e502bf251eaf300073dde00c0a39bd1061fb04de', 'valid commit oid')
  }

  {
    const oid = await writeObject({
      type: 'tag',
      object: Buffer.from('hello world'),
      dryrun: true
    })

    t.is(oid, '56b196e779ce7b1856166b8eea655068d3b01537', 'valid tag oid')
  }

  {
    const oid = await writeObject({
      type: 'blob',
      object: Buffer.from('hello world'),
      dryrun: true
    })

    t.is(oid, '95d09f2b10159347eece71399a7e2e907ea3df4f', 'valid blob oid')
  }
})
