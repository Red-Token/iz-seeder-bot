it('String test', async function() {
    let rest = ''

    const str = 'sjkfsfsjf sjkfsdjkfsjkfsdjkfsd ssssss'

    const x = str.split(' ')

    for (const [i, z] of x.entries()) {
        if (i === x.length - 1) {
            rest = z
            continue
        }

        console.log(z)
    }

    console.log(rest)
})
