import {spawn} from 'node:child_process'
import EventEmitter from 'node:events'

export function mp4box(inFile?: string) {
    return new MP4Box(inFile)
}

const typeMap = new Map<string, string>([
    ['\x1b[31m', 'error'],
    ['\x1b[32m', 'info'],
    ['\x1b[33m', 'warning'],
    ['\x1b[37m', 'progress']
])

const endMarker = '\x1B[0m'

export class MP4Box extends EventEmitter {
    private options: string[] = []
    private files: string[] = []

    constructor(inFile?: string) {
        super()

        if (inFile !== undefined) {
            this.options.push(inFile)
        }
    }

    addOption(...options: string[]): MP4Box {
        this.options.push(...options)
        return this
    }

    addInputFiles(...files: string[]): MP4Box {
        this.options.push(...files)
        return this
    }

    // addListener(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;

    run() {
        const args = [...this.options, ...this.files]
        this.emit('start', {command: 'MP4Box', args})

        const process = spawn('MP4Box', args)

        let str = ''

        process.stderr.on('data', (data: Buffer) => {
            str += data.toString()

            const tokens = str.split(endMarker)

            for (const [i, tokenString] of str.split(endMarker).entries()) {

                // if this is the last one, we simply add it to the str variable and conti
                if (i === tokens.length - 1) {
                    str = tokenString
                    continue
                }

                const startMarker = tokenString.substring(0, 5)
                const message = tokenString.substring(5)
                const type = typeMap.get(startMarker)

                if (type === undefined) {
                    this.emit('info', tokenString)
                    continue
                }

                // console.log(tokenString)
                // console.log(`${type} ${message}`)
                this.emit(type, message)
            }
        })

        process.on('close', (code, signal) => {
            this.emit('close', {code, signal})
            if (code == 0) {
                this.emit('end')
                return
            }

            this.emit('error', new Error('MP4Box failed with code ' + code))
        })
    }
}
